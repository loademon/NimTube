import { 
  isExtensionAvailable, 
  probeStreamViaExtension, 
  fetchChunkViaExtension,
  fetchSegmentBatchViaExtension 
} from '../extension/extensionBridge';

export interface DownloadProgressUpdate {
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes/sec
  speedFormatted: string;
  etaSeconds: number;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) {
    return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
  }
  if (bytesPerSec >= 1024) {
    return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  }
  return Math.round(bytesPerSec) + ' B/s';
}

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per chunk
const CONCURRENCY = 4; // 4 concurrent connections
const SEGMENT_CONCURRENCY = 24; // 24 concurrent connections for DASH segments

export function buildShardedUrl(baseUrl: string, shardIndex: number): string {
  try {
    const u = new URL(baseUrl);
    const match = u.host.match(/^rr(\d+)---(.+)$/);
    if (match) {
      const rest = match[2];
      const shardNum = (shardIndex % 5) + 1; // Cycles through rr1, rr2, rr3, rr4, rr5
      u.host = `rr${shardNum}---${rest}`;
    }
    return u.toString();
  } catch {
    return baseUrl;
  }
}

export function buildSegmentUrl(baseUrl: string, sq: number): string {
  const sharded = buildShardedUrl(baseUrl, sq);
  const u = new URL(sharded);
  u.searchParams.set('sq', String(sq));
  return u.toString();
}

interface StreamProbeInfo {
  totalBytes: number;
  isSegmented: boolean;
  headSeqNum: number;
}

// Probe stream: distinguishes normal linear streams from segmented DASH live streams
async function probeStreamInfo(
  directOrProxyUrl: string,
  rawUrl: string,
  useExtension: boolean,
  signal?: AbortSignal
): Promise<StreamProbeInfo> {
  const isLive =
    rawUrl.includes('noclen=1') ||
    rawUrl.includes('source=yt_live_broadcast') ||
    rawUrl.includes('live=1');

  if (useExtension) {
    const extProbe = await probeStreamViaExtension(rawUrl, 8000);
    if (extProbe.isSegmented || extProbe.totalBytes > 1) {
      return extProbe;
    }
    if (isLive) {
      return {
        totalBytes: 0,
        isSegmented: true,
        headSeqNum: extProbe.headSeqNum || 0,
      };
    }
    // When extension is active, never fall through to direct browser fetch (avoids CORS hangs)
    return extProbe;
  }

  try {
    const probeRes = await fetch(directOrProxyUrl, {
      headers: { 'Range': 'bytes=0-0' },
      signal,
    });

    const headSeqHeader = probeRes.headers.get('x-head-seqnum') || probeRes.headers.get('x-sequence-num');
    let headSeq = headSeqHeader ? parseInt(headSeqHeader, 10) : 0;
    const contentRange = probeRes.headers.get('content-range') || '';
    const contentLength = probeRes.headers.get('content-length') || '';
    const isRangeLive = isLive || contentRange.endsWith('/1');

    if (headSeq > 0 || isRangeLive) {
      return {
        totalBytes: 0,
        isSegmented: true,
        headSeqNum: headSeq,
      };
    }

    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > 1) {
          return { totalBytes: val, isSegmented: false, headSeqNum: 0 };
        }
      }
    }

    if (contentLength) {
      const len = parseInt(contentLength, 10);
      if (len > 1) {
        return { totalBytes: len, isSegmented: false, headSeqNum: 0 };
      }
    }
  } catch (err) {
    console.warn('[StreamDownloader] Probe hatası:', err);
  }

  return { totalBytes: 0, isSegmented: isLive, headSeqNum: 0 };
}

// Download segmented DASH stream (sq=0, 1, 2, ..., N)
async function downloadSegmentedStream(
  url: string,
  proxyUrl: string,
  headSeqNum: number,
  useExtension: boolean,
  onProgress: (update: DownloadProgressUpdate) => void,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const totalSegments = headSeqNum + 1;
  console.log(`%c[StreamDownloader]%c Canlı yayın sekans indirmesi başlatılıyor: ${totalSegments} parça (sq=0..${headSeqNum})`, 'color: #3b82f6; font-weight: bold;', 'color: inherit;');

  const segmentBuffers: (Uint8Array | null)[] = new Array(totalSegments).fill(null);

  let nextSq = 0;
  let completedCount = 0;
  let totalDownloadedBytes = 0;
  let lastTime = Date.now();
  let lastBytes = 0;
  let currentSpeed = 0;
  let activeError: Error | null = null;

  // Progress reporting helper
  const reportProgress = () => {
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000;
    if (timeDiff >= 0.25 || completedCount >= totalSegments) {
      const bytesDiff = totalDownloadedBytes - lastBytes;
      currentSpeed = bytesDiff / (timeDiff || 1);
      lastTime = now;
      lastBytes = totalDownloadedBytes;

      const percentage = Math.min(100, Math.round((completedCount / totalSegments) * 100));
      const avgSegSize = totalDownloadedBytes / (completedCount || 1);
      const estimatedTotalBytes = Math.round(avgSegSize * totalSegments);
      const remainingBytes = Math.max(0, estimatedTotalBytes - totalDownloadedBytes);
      const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

      onProgress({
        downloadedBytes: totalDownloadedBytes,
        totalBytes: estimatedTotalBytes,
        percentage,
        speed: currentSpeed,
        speedFormatted: formatSpeed(currentSpeed),
        etaSeconds,
      });
    }
  };

  // --- TIER 1: Direct Native Fetch (CORS unblocked by Extension DeclarativeNetRequest) ---
  let canUseDirectFetch = false;
  try {
    const testUrl = buildSegmentUrl(url, 0);
    const testRes = await fetch(testUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (testRes.ok || testRes.status === 204) {
      canUseDirectFetch = true;
      if (testRes.ok) {
        const buf0 = await testRes.arrayBuffer();
        if (buf0 && buf0.byteLength > 0) {
          segmentBuffers[0] = new Uint8Array(buf0);
          totalDownloadedBytes += buf0.byteLength;
          completedCount++;
        }
      }
      nextSq = 1;
      console.log('%c[StreamDownloader]%c Doğrudan tarayıcı indirmesi (Direct Native Fetch) devrede! En yüksek bant genişliği.', 'color: #10b981; font-weight: bold;', 'color: inherit;');
    }
  } catch {
    canUseDirectFetch = false;
  }

  if (canUseDirectFetch) {
    const DIRECT_CONCURRENCY = 20;
    const directWorker = async () => {
      while (nextSq <= headSeqNum && !activeError) {
        if (signal?.aborted) throw new Error('İndirme iptal edildi.');
        const sq = nextSq++;
        if (sq > headSeqNum) break;

        const segmentUrl = buildSegmentUrl(url, sq);
        try {
          const res = await fetch(segmentUrl, { signal });
          if (!res.ok) {
            if (res.status === 204) {
              completedCount++;
              reportProgress();
              continue;
            }
            throw new Error(`HTTP ${res.status}`);
          }
          const buf = await res.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            segmentBuffers[sq] = new Uint8Array(buf);
            totalDownloadedBytes += buf.byteLength;
          }
          completedCount++;
          reportProgress();
        } catch (err: any) {
          activeError = err;
          break;
        }
      }
    };

    const workerPromises = Array.from(
      { length: Math.min(DIRECT_CONCURRENCY, totalSegments - nextSq) },
      () => directWorker()
    );
    await Promise.all(workerPromises);

    if (!activeError) {
      const completeBuffer = new Uint8Array(totalDownloadedBytes);
      let offset = 0;
      for (let i = 0; i <= headSeqNum; i++) {
        const chunk = segmentBuffers[i];
        if (chunk) {
          completeBuffer.set(chunk, offset);
          offset += chunk.byteLength;
          segmentBuffers[i] = null;
        }
      }

      const finalMb = (totalDownloadedBytes / (1024 * 1024)).toFixed(2);
      console.log(`%c[StreamDownloader]%c Doğrudan sekans indirmesi başarıyla tamamlandı: ${finalMb} MB (${completedCount}/${totalSegments} parça)`, 'color: #10b981; font-weight: bold;', 'color: inherit;');

      onProgress({
        downloadedBytes: totalDownloadedBytes,
        totalBytes: totalDownloadedBytes,
        percentage: 100,
        speed: currentSpeed,
        speedFormatted: formatSpeed(currentSpeed),
        etaSeconds: 0,
      });

      return completeBuffer.buffer;
    }

    console.warn('[StreamDownloader] Doğrudan indirmede aksaklık yaşandı, eklenti katmanına geçiliyor:', activeError);
    activeError = null;
  }

  // --- TIER 2: Extension Turbo Batch Downloader ---
  let useBatch = useExtension;
  if (useBatch) {
    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(totalSegments / BATCH_SIZE);
    const batchBuffers: (Uint8Array | null)[] = new Array(totalBatches).fill(null);
    let nextBatchIndex = Math.floor(nextSq / BATCH_SIZE);

    try {
      const BATCH_WORKERS = 4;
      const batchWorker = async () => {
        while (nextBatchIndex < totalBatches && !activeError) {
          if (signal?.aborted) throw new Error('İndirme iptal edildi.');
          const bIdx = nextBatchIndex++;
          if (bIdx >= totalBatches) break;

          const startSq = bIdx * BATCH_SIZE;
          const count = Math.min(BATCH_SIZE, totalSegments - startSq);

          const buf = await fetchSegmentBatchViaExtension(url, startSq, count);

          if (buf && buf.byteLength > 0) {
            batchBuffers[bIdx] = new Uint8Array(buf);
            totalDownloadedBytes += buf.byteLength;
          }
          completedCount += count;
          reportProgress();
        }
      };

      const promises = Array.from({ length: Math.min(BATCH_WORKERS, totalBatches) }, () => batchWorker());
      await Promise.all(promises);

      const completeBuffer = new Uint8Array(totalDownloadedBytes);
      let offset = 0;
      for (let i = 0; i < totalBatches; i++) {
        const chunk = batchBuffers[i];
        if (chunk) {
          completeBuffer.set(chunk, offset);
          offset += chunk.byteLength;
          batchBuffers[i] = null;
        }
      }

      const finalMb = (totalDownloadedBytes / (1024 * 1024)).toFixed(2);
      console.log(`%c[StreamDownloader]%c Turbo Toplu İndirme tamamlandı: ${finalMb} MB (${completedCount}/${totalSegments} parça)`, 'color: #10b981; font-weight: bold;', 'color: inherit;');

      onProgress({
        downloadedBytes: totalDownloadedBytes,
        totalBytes: totalDownloadedBytes,
        percentage: 100,
        speed: currentSpeed,
        speedFormatted: formatSpeed(currentSpeed),
        etaSeconds: 0,
      });

      return completeBuffer.buffer;
    } catch (batchErr) {
      console.warn('[StreamDownloader] Toplu indirme yapılamadı, bireysel paralel moda geçiliyor:', batchErr);
      useBatch = false;
      nextSq = 0;
      completedCount = 0;
      totalDownloadedBytes = 0;
      lastBytes = 0;
    }
  }

  // --- TIER 3: Individual Extension Fetch (Fallback) ---
  const worker = async () => {
    while (nextSq <= headSeqNum && !activeError) {
      if (signal?.aborted) throw new Error('İndirme iptal edildi.');
      const sq = nextSq++;
      if (sq > headSeqNum) break;

      const segmentUrl = buildSegmentUrl(url, sq);
      const directOrProxySegmentUrl = proxyUrl ? `${proxyUrl}${encodeURIComponent(segmentUrl)}` : segmentUrl;

      let arrayBuf: ArrayBuffer | null = null;
      if (useExtension) {
        let retries = 2;
        while (retries >= 0 && !arrayBuf && !activeError) {
          try {
            arrayBuf = await fetchChunkViaExtension(segmentUrl, '');
          } catch (extErr: any) {
            retries--;
            if (retries < 0) {
              if (proxyUrl) {
                try {
                  const res = await fetch(directOrProxySegmentUrl, { signal });
                  if (res.ok) arrayBuf = await res.arrayBuffer();
                } catch {}
              }
              if (!arrayBuf) {
                console.warn(`[StreamDownloader] Sekans parçası (sq=${sq}) indirilemedi:`, extErr);
                activeError = new Error(`Sekans parçası indirilemedi (sq=${sq}): ${extErr?.message || 'Eklenti hatası'}`);
              }
            } else {
              await new Promise((r) => setTimeout(r, 200));
            }
          }
        }
      }

      if (!arrayBuf && !useExtension) {
        const res = await fetch(directOrProxySegmentUrl, { signal });
        if (!res.ok) {
          if (res.status === 204) {
            continue;
          }
          throw new Error(`Sekans parçası indirilemedi (sq=${sq}, HTTP ${res.status})`);
        }
        arrayBuf = await res.arrayBuffer();
      }

      if (arrayBuf && arrayBuf.byteLength > 0) {
        segmentBuffers[sq] = new Uint8Array(arrayBuf);
        totalDownloadedBytes += arrayBuf.byteLength;
      }
      completedCount++;
      reportProgress();
    }
  };

  const poolSize = Math.min(20, totalSegments);
  const workerPromises = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workerPromises);

  if (activeError) throw activeError;

  // Assembling all segments in strict order into a single Fragmented MP4 Buffer
  const completeBuffer = new Uint8Array(totalDownloadedBytes);
  let offset = 0;
  for (let i = 0; i <= headSeqNum; i++) {
    const chunk = segmentBuffers[i];
    if (chunk) {
      completeBuffer.set(chunk, offset);
      offset += chunk.byteLength;
      segmentBuffers[i] = null; // Free memory immediately
    }
  }

  const finalMb = (totalDownloadedBytes / (1024 * 1024)).toFixed(2);
  console.log(`%c[StreamDownloader]%c Sekans indirmesi tamamlandı: ${finalMb} MB (${completedCount}/${totalSegments} parça)`, 'color: #10b981; font-weight: bold;', 'color: inherit;');

  onProgress({
    downloadedBytes: totalDownloadedBytes,
    totalBytes: totalDownloadedBytes,
    percentage: 100,
    speed: currentSpeed,
    speedFormatted: formatSpeed(currentSpeed),
    etaSeconds: 0,
  });

  return completeBuffer.buffer;
}

export async function downloadStreamWithProgress(
  url: string,
  proxyUrl: string,
  onProgress: (update: DownloadProgressUpdate) => void,
  signal?: AbortSignal,
  expectedDurationSeconds?: number,
  knownFilesize?: number
): Promise<ArrayBuffer> {
  const useExtension = isExtensionAvailable();
  const directOrProxyUrl = proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;

  // FAST PATH 1: Instantly recognize live / segmented stream (0 ms - no network roundtrip needed!)
  const isSegmented =
    url.includes('noclen=1') ||
    url.includes('source=yt_live_broadcast') ||
    url.includes('live=1');

  if (isSegmented) {
    let headSeq = 0;
    if (useExtension) {
      try {
        const extProbe = await probeStreamViaExtension(url, 8000);
        headSeq = extProbe.headSeqNum;
      } catch {}
    }
    // Instant fallback to duration if header isn't returned
    if (!headSeq && expectedDurationSeconds && expectedDurationSeconds > 0) {
      headSeq = Math.ceil(expectedDurationSeconds);
    }
    if (headSeq > 0) {
      return await downloadSegmentedStream(
        url,
        proxyUrl,
        headSeq,
        useExtension,
        onProgress,
        signal
      );
    }
  }

  // FAST PATH 2: If format already provides knownFilesize > 1, start chunk download immediately (0 ms!)
  let totalBytes = (knownFilesize && knownFilesize > 1) ? knownFilesize : 0;

  if (totalBytes === 0) {
    const probe = await probeStreamInfo(directOrProxyUrl, url, useExtension, signal);
    if (probe.isSegmented && probe.headSeqNum > 0) {
      return await downloadSegmentedStream(
        url,
        proxyUrl,
        probe.headSeqNum,
        useExtension,
        onProgress,
        signal
      );
    }
    totalBytes = probe.totalBytes;
  }

  // --- PATH B: PARALLEL MULTI-CHUNK TURBO DOWNLOADER ---
  if (totalBytes > 0) {
    const sizeMb = (totalBytes / (1024 * 1024)).toFixed(2);
    console.log(`%c[StreamDownloader]%c Akış boyutu: ${sizeMb} MB (${totalBytes} bayt)`, 'color: #a855f7; font-weight: bold;', 'color: inherit;');
    const completeBuffer = new Uint8Array(totalBytes);
    let totalDownloaded = 0;

    // Create chunks list
    const chunks: { index: number; start: number; end: number }[] = [];
    for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
      chunks.push({
        index: chunks.length,
        start: offset,
        end: Math.min(totalBytes - 1, offset + CHUNK_SIZE - 1),
      });
    }

    let nextChunkIndex = 0;
    let activeError: Error | null = null;
    let lastTime = Date.now();
    let lastBytes = 0;
    let currentSpeed = 0;

    let canDirectFetch = false;
    try {
      const probeRes = await fetch(url, { headers: { 'Range': 'bytes=0-0' }, signal: AbortSignal.timeout(3000) });
      if (probeRes.ok || probeRes.status === 206) {
        canDirectFetch = true;
        console.log('%c[StreamDownloader]%c Doğrudan akış indirmesi (Direct Linear Fetch) devrede!', 'color: #10b981; font-weight: bold;', 'color: inherit;');
      }
    } catch {}

    // Worker function
    const worker = async () => {
      while (nextChunkIndex < chunks.length && !activeError) {
        if (signal?.aborted) throw new Error('İndirme iptal edildi.');
        const chunk = chunks[nextChunkIndex++];
        if (!chunk) break;

        const range = `bytes=${chunk.start}-${chunk.end}`;
        const targetUrl = buildShardedUrl(url, chunk.index);
        let arrayBuf: ArrayBuffer | null = null;

        // Path A: Direct Native Fetch (Zero IPC, Zero Base64)
        if (canDirectFetch) {
          try {
            const res = await fetch(targetUrl, { headers: { 'Range': range }, signal });
            if (res.ok || res.status === 206) {
              arrayBuf = await res.arrayBuffer();
            }
          } catch {
            canDirectFetch = false;
          }
        }

        // Path B: Direct via Extension
        if (!arrayBuf && useExtension) {
          try {
            arrayBuf = await fetchChunkViaExtension(targetUrl, range);
          } catch (extErr) {
            console.warn(`[StreamDownloader] Eklenti parçası başarısız (${range}), yedek deneniyor:`, extErr);
            arrayBuf = null;
          }
        }

        // Path C: Direct / Custom Proxy fallback
        if (!arrayBuf) {
          if (!proxyUrl && useExtension) {
            throw new Error(`Eklenti ile parça indirilemedi (${range})`);
          }
          const proxyTarget = proxyUrl ? `${proxyUrl}${encodeURIComponent(targetUrl)}` : targetUrl;
          const res = await fetch(proxyTarget, {
            headers: { 'Range': range },
            signal,
          });

          if (!res.ok && res.status !== 206) {
            throw new Error(`Parça indirilemedi (${range}, HTTP ${res.status})`);
          }

          arrayBuf = await res.arrayBuffer();
        }

        completeBuffer.set(new Uint8Array(arrayBuf), chunk.start);
        totalDownloaded += arrayBuf.byteLength;

        // Progress calculation
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        if (timeDiff >= 0.25 || totalDownloaded === totalBytes) {
          const bytesDiff = totalDownloaded - lastBytes;
          currentSpeed = bytesDiff / (timeDiff || 1);
          lastTime = now;
          lastBytes = totalDownloaded;

          const percentage = Math.min(100, Math.round((totalDownloaded / totalBytes) * 100));
          const remainingBytes = totalBytes - totalDownloaded;
          const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

          onProgress({
            downloadedBytes: totalDownloaded,
            totalBytes,
            percentage,
            speed: currentSpeed,
            speedFormatted: formatSpeed(currentSpeed),
            etaSeconds,
          });
        }
      }
    };

    const workerPromises: Promise<void>[] = [];
    const poolSize = Math.min(CONCURRENCY, chunks.length);
    for (let i = 0; i < poolSize; i++) {
      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);

    onProgress({
      downloadedBytes: totalBytes,
      totalBytes,
      percentage: 100,
      speed: currentSpeed,
      speedFormatted: formatSpeed(currentSpeed),
      etaSeconds: 0,
    });

    return completeBuffer.buffer;
  }

  // --- PATH C: FALLBACK SEQUENTIAL (Extension safe) ---
  console.warn('[StreamDownloader] Akış boyutu tespit edilemedi (0 bayt), sıralı indirmeye geçiliyor...');
  if (useExtension) {
    console.log('[StreamDownloader] Eklenti üzerinden doğrudan akış çekiliyor...');
    return await fetchChunkViaExtension(url, '');
  }

  const res = await fetch(directOrProxyUrl, { signal });
  if (!res.ok || !res.body) throw new Error('Medya akışı başlatılamadı.');

  const reader = res.body.getReader();
  const rawChunks: Uint8Array[] = [];
  let downloaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      rawChunks.push(value);
      downloaded += value.length;
    }
  }

  const complete = new Uint8Array(downloaded);
  let pos = 0;
  for (const c of rawChunks) {
    complete.set(c, pos);
    pos += c.length;
  }
  return complete.buffer;
}

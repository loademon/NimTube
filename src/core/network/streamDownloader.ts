import {
  isExtensionAvailable,
  probeStreamViaExtension,
  fetchChunkViaExtension,
  fetchSegmentBatchViaExtension
} from '../extension/extensionBridge';
import type { ByteSink } from '../storage/byteSink';
import { runAdaptivePool } from './adaptivePool';

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

/**
 * 8MB per chunk. YouTube throttles single requests larger than ~10MB to
 * roughly real-time speed, so chunks must stay below that.
 */
const CHUNK_SIZE = 8 * 1024 * 1024;
/**
 * Range downloads: parallel request count is tuned at runtime by the adaptive
 * pool. Browsers share one HTTP/2 / QUIC connection per host, so a small
 * number of requests is often faster than many.
 */
const RANGE_POOL_MIN = 1;
const RANGE_POOL_MAX = 6;
const RANGE_POOL_INITIAL = 2;
const SEGMENT_POOL_MIN = 4;
const SEGMENT_POOL_MAX = 24;
const DIRECT_SEGMENT_INITIAL = 12;
const EXTENSION_SEGMENT_INITIAL = 12;
const BATCH_SIZE = 10;
const BATCH_WORKERS = 4;
/**
 * Max number of segments a worker may run ahead of the oldest unwritten one.
 * Bounds RAM usage for segmented (live) downloads regardless of video length.
 */
const MAX_SEGMENTS_AHEAD = 64;
const MAX_RETRIES = 3;

export function buildSegmentUrl(baseUrl: string, sq: number): string {
  const u = new URL(baseUrl);
  u.searchParams.set('sq', String(sq));
  return u.toString();
}

function abortError(): Error {
  const err = new Error('İndirme iptal edildi.');
  err.name = 'AbortError';
  return err;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, retries = MAX_RETRIES): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw abortError();
    try {
      return await fn();
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) throw abortError();
      lastErr = err;
      if (attempt < retries) await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr;
}

/**
 * Writes segments to the sink strictly in order while allowing parallel fetches.
 * Only a bounded window of out-of-order segments is held in memory.
 */
class OrderedSegmentWriter {
  nextIndex: number;
  position: number;
  private pending = new Map<number, Uint8Array | null>();
  private waiters: Array<() => void> = [];
  private stopped = false;

  constructor(private sink: ByteSink, startIndex = 0, startPosition = 0) {
    this.nextIndex = startIndex;
    this.position = startPosition;
  }

  /**
   * Resolves `true` once `index` is within the allowed window ahead of the
   * write cursor, or `false` if the current tier was stopped meanwhile.
   */
  async waitForSlot(index: number, signal?: AbortSignal): Promise<boolean> {
    while (index >= this.nextIndex + MAX_SEGMENTS_AHEAD) {
      if (signal?.aborted) throw abortError();
      if (this.stopped) return false;
      await new Promise<void>((resolve) => {
        const onAbort = () => resolve();
        signal?.addEventListener('abort', onAbort, { once: true });
        this.waiters.push(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        });
      });
    }
    return !this.stopped;
  }

  /** Releases every waiting worker of the current tier (used after an error). */
  stop() {
    this.stopped = true;
    this.wakeAll();
  }

  async put(index: number, data: Uint8Array | null): Promise<void> {
    this.pending.set(index, data);
    const writes: Promise<void>[] = [];
    while (this.pending.has(this.nextIndex)) {
      const chunk = this.pending.get(this.nextIndex)!;
      this.pending.delete(this.nextIndex);
      this.nextIndex++;
      if (chunk && chunk.byteLength > 0) {
        const pos = this.position;
        this.position += chunk.byteLength;
        writes.push(this.sink.write(pos, chunk));
      }
    }
    if (writes.length) {
      await Promise.all(writes);
      const w = this.waiters;
      this.waiters = [];
      w.forEach((fn) => fn());
    }
  }

  /** Drops out-of-order data (used when switching to a fallback tier). */
  resetPending() {
    this.pending.clear();
    this.stopped = false;
    const w = this.waiters;
    this.waiters = [];
    w.forEach((fn) => fn());
  }

  wakeAll() {
    const w = this.waiters;
    this.waiters = [];
    w.forEach((fn) => fn());
  }
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
    const headSeq = headSeqHeader ? parseInt(headSeqHeader, 10) : 0;
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

// Download segmented DASH stream (sq=0, 1, 2, ..., N) straight into the sink
async function downloadSegmentedStream(
  url: string,
  proxyUrl: string,
  headSeqNum: number,
  useExtension: boolean,
  sink: ByteSink,
  onProgress: (update: DownloadProgressUpdate) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const totalSegments = headSeqNum + 1;
  console.log(`%c[StreamDownloader]%c Canlı yayın sekans indirmesi başlatılıyor: ${totalSegments} parça (sq=0..${headSeqNum})`, 'color: #3b82f6; font-weight: bold;', 'color: inherit;');

  const writer = new OrderedSegmentWriter(sink);
  let completedCount = 0;
  let totalDownloadedBytes = 0;
  let lastTime = Date.now();
  let lastBytes = 0;
  let currentSpeed = 0;

  const reportProgress = (force = false) => {
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000;
    if (force || timeDiff >= 0.25) {
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

  /**
   * Runs segment workers starting at `startSq` in an adaptive pool whose size
   * follows the measured throughput. Returns the first error, if any.
   */
  const runPool = async (
    startSq: number,
    initial: number,
    fetchSegment: (sq: number) => Promise<ArrayBuffer | null>
  ): Promise<Error | null> => {
    let nextSq = startSq;
    let failed = false;

    try {
      await runAdaptivePool({
        min: SEGMENT_POOL_MIN,
        max: SEGMENT_POOL_MAX,
        initial,
        signal,
        label: 'segment',
        next: () => {
          if (failed || nextSq > headSeqNum) return null;
          const sq = nextSq++;
          return async (onBytes) => {
            if (!(await writer.waitForSlot(sq, signal))) return;
            try {
              const buf = await withRetry(() => fetchSegment(sq), signal);
              const data = buf && buf.byteLength > 0 ? new Uint8Array(buf) : null;
              if (data) {
                totalDownloadedBytes += data.byteLength;
                onBytes(data.byteLength);
              }
              completedCount++;
              await writer.put(sq, data);
              reportProgress();
            } catch (err: any) {
              if (err?.name !== 'AbortError') {
                failed = true;
                writer.stop();
              }
              throw err;
            }
          };
        },
      });
      return null;
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) throw abortError();
      return err instanceof Error ? err : new Error(String(err));
    }
  };

  /** After a tier failure, continue from the last contiguous segment already on disk. */
  const resumePoint = () => {
    writer.resetPending();
    completedCount = writer.nextIndex;
    totalDownloadedBytes = writer.position;
    lastBytes = totalDownloadedBytes;
    return writer.nextIndex;
  };

  const finish = async (label: string) => {
    const finalMb = (writer.position / (1024 * 1024)).toFixed(2);
    console.log(`%c[StreamDownloader]%c ${label} tamamlandı: ${finalMb} MB (${completedCount}/${totalSegments} parça)`, 'color: #10b981; font-weight: bold;', 'color: inherit;');
    reportProgress(true);
    onProgress({
      downloadedBytes: totalDownloadedBytes,
      totalBytes: totalDownloadedBytes,
      percentage: 100,
      speed: currentSpeed,
      speedFormatted: formatSpeed(currentSpeed),
      etaSeconds: 0,
    });
    return await sink.finish();
  };

  // --- TIER 1: Direct Native Fetch (CORS unblocked by Extension DeclarativeNetRequest) ---
  let canUseDirectFetch = false;
  try {
    const testRes = await fetch(buildSegmentUrl(url, 0), { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (testRes.ok || testRes.status === 204) {
      canUseDirectFetch = true;
      const buf0 = testRes.ok ? await testRes.arrayBuffer() : null;
      const data0 = buf0 && buf0.byteLength > 0 ? new Uint8Array(buf0) : null;
      if (data0) totalDownloadedBytes += data0.byteLength;
      completedCount++;
      await writer.put(0, data0);
      console.log('%c[StreamDownloader]%c Doğrudan tarayıcı indirmesi (Direct Native Fetch) devrede! En yüksek bant genişliği.', 'color: #10b981; font-weight: bold;', 'color: inherit;');
    }
  } catch {
    canUseDirectFetch = false;
  }

  if (canUseDirectFetch) {
    const err = await runPool(1, DIRECT_SEGMENT_INITIAL, async (sq) => {
      const res = await fetch(buildSegmentUrl(url, sq), { signal });
      if (res.status === 204) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.arrayBuffer();
    });
    if (!err) return await finish('Doğrudan sekans indirmesi');
    console.warn('[StreamDownloader] Doğrudan indirmede aksaklık yaşandı, eklenti katmanına geçiliyor:', err);
  }

  // --- TIER 2: Extension Turbo Batch Downloader ---
  if (useExtension) {
    const startSq = resumePoint();
    let batchError: Error | null = null;
    let nextBatchSq = startSq;

    const batchWorker = async () => {
      while (nextBatchSq <= headSeqNum && !batchError) {
        if (signal?.aborted) throw abortError();
        const firstSq = nextBatchSq;
        const count = Math.min(BATCH_SIZE, headSeqNum - firstSq + 1);
        nextBatchSq += count;
        if (!(await writer.waitForSlot(firstSq + count - 1, signal)) || batchError) break;
        try {
          const buf = await withRetry(() => fetchSegmentBatchViaExtension(url, firstSq, count), signal);
          if (!buf || buf.byteLength === 0) {
            throw new Error(`Toplu parça indirme boş döndü (sq=${firstSq})`);
          }
          const data = new Uint8Array(buf);
          totalDownloadedBytes += data.byteLength;
          completedCount += count;
          // Batch holds `count` segments: put the bytes at firstSq and mark the rest as consumed.
          const puts: Promise<void>[] = [];
          for (let k = count - 1; k >= 1; k--) puts.push(writer.put(firstSq + k, null));
          puts.push(writer.put(firstSq, data));
          await Promise.all(puts);
          reportProgress();
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err;
          batchError = err;
          writer.stop();
          break;
        }
      }
    };

    await Promise.all(Array.from({ length: BATCH_WORKERS }, batchWorker));
    if (!batchError && writer.nextIndex > headSeqNum) return await finish('Turbo toplu indirme');
    console.warn('[StreamDownloader] Toplu indirme yapılamadı, bireysel paralel moda geçiliyor:', batchError);
  }

  // --- TIER 3: Individual Extension / Proxy Fetch (Fallback) ---
  const startSq = resumePoint();
  const err = await runPool(startSq, EXTENSION_SEGMENT_INITIAL, async (sq) => {
    const segmentUrl = buildSegmentUrl(url, sq);
    if (useExtension) {
      try {
        return await fetchChunkViaExtension(segmentUrl, '');
      } catch (extErr) {
        if (!proxyUrl) throw extErr;
      }
    }
    const target = proxyUrl ? `${proxyUrl}${encodeURIComponent(segmentUrl)}` : segmentUrl;
    const res = await fetch(target, { signal });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.arrayBuffer();
  });

  if (err) {
    console.error('[StreamDownloader] Sekans indirmesi başarısız:', err);
    throw new Error('Video parçaları indirilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.');
  }

  return await finish('Sekans indirmesi');
}

export interface DownloadStreamOptions {
  url: string;
  proxyUrl: string;
  sink: ByteSink;
  onProgress: (update: DownloadProgressUpdate) => void;
  signal?: AbortSignal;
  expectedDurationSeconds?: number;
  knownFilesize?: number;
}

/**
 * Downloads a stream directly into `sink` (disk-backed), returning a lazily
 * readable Blob of the result. Memory usage stays bounded regardless of size.
 */
export async function downloadStreamWithProgress({
  url,
  proxyUrl,
  sink,
  onProgress,
  signal,
  expectedDurationSeconds,
  knownFilesize,
}: DownloadStreamOptions): Promise<Blob> {
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
      return await downloadSegmentedStream(url, proxyUrl, headSeq, useExtension, sink, onProgress, signal);
    }
  }

  // FAST PATH 2: If format already provides knownFilesize > 1, start chunk download immediately (0 ms!)
  let totalBytes = (knownFilesize && knownFilesize > 1) ? knownFilesize : 0;

  if (totalBytes === 0) {
    const probe = await probeStreamInfo(directOrProxyUrl, url, useExtension, signal);
    if (probe.isSegmented && probe.headSeqNum > 0) {
      return await downloadSegmentedStream(url, proxyUrl, probe.headSeqNum, useExtension, sink, onProgress, signal);
    }
    totalBytes = probe.totalBytes;
  }

  // --- PATH B: PARALLEL MULTI-CHUNK TURBO DOWNLOADER (positional writes, bounded memory) ---
  if (totalBytes > 0) {
    const sizeMb = (totalBytes / (1024 * 1024)).toFixed(2);
    console.log(`%c[StreamDownloader]%c Akış boyutu: ${sizeMb} MB (${totalBytes} bayt)`, 'color: #a855f7; font-weight: bold;', 'color: inherit;');

    const chunkCount = Math.ceil(totalBytes / CHUNK_SIZE);
    let nextChunkIndex = 0;
    let totalDownloaded = 0;
    let failed = false;
    let lastTime = Date.now();
    let lastBytes = 0;
    let currentSpeed = 0;

    const reportProgress = (force = false) => {
      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      if (!force && timeDiff < 0.5) return;
      const instant = (totalDownloaded - lastBytes) / (timeDiff || 1);
      // Smooth the displayed speed so it doesn't jump around between chunks.
      currentSpeed = currentSpeed > 0 ? currentSpeed * 0.7 + instant * 0.3 : instant;
      lastTime = now;
      lastBytes = totalDownloaded;

      const percentage = Math.min(100, Math.round((totalDownloaded / totalBytes) * 100));
      const remainingBytes = Math.max(0, totalBytes - totalDownloaded);
      const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

      onProgress({
        downloadedBytes: totalDownloaded,
        totalBytes,
        percentage,
        speed: currentSpeed,
        speedFormatted: formatSpeed(currentSpeed),
        etaSeconds,
      });
    };

    // Direct requests pass the byte range as a query parameter (googlevideo
    // supports `&range=start-end`). Unlike a Range header this needs no CORS
    // preflight, saving a round trip per chunk.
    const rangeUrl = (start: number, end: number) => {
      const u = new URL(url);
      u.searchParams.set('range', `${start}-${end}`);
      return u.toString();
    };

    let canDirectFetch = false;
    try {
      const probeRes = await fetch(rangeUrl(0, 1023), { signal: AbortSignal.timeout(3000) });
      if (probeRes.ok || probeRes.status === 206) {
        await probeRes.arrayBuffer();
        canDirectFetch = true;
        console.log('%c[StreamDownloader]%c Doğrudan akış indirmesi (Direct Linear Fetch) devrede!', 'color: #10b981; font-weight: bold;', 'color: inherit;');
      }
    } catch {}

    /** Reads a response body into a buffer of exactly `length` bytes, reporting bytes as they arrive. */
    const readBody = async (res: Response, length: number, onBytes: (n: number) => void): Promise<Uint8Array> => {
      if (!res.body) {
        const buf = new Uint8Array(await res.arrayBuffer());
        onBytes(buf.byteLength);
        return buf;
      }
      const out = new Uint8Array(length);
      const reader = res.body.getReader();
      let offset = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (offset + value.byteLength > length) throw new Error('Beklenenden uzun yanıt');
          out.set(value, offset);
          offset += value.byteLength;
          onBytes(value.byteLength);
        }
      } finally {
        reader.releaseLock();
      }
      if (offset !== length) throw new Error(`Eksik yanıt (${offset}/${length})`);
      return out;
    };

    const fetchRange = async (start: number, end: number, onBytes: (n: number) => void): Promise<Uint8Array> => {
      const range = `bytes=${start}-${end}`;
      const length = end - start + 1;

      // Path A: Direct Native Fetch (Zero IPC, Zero Base64)
      if (canDirectFetch) {
        let partial = 0;
        try {
          const res = await fetch(rangeUrl(start, end), { signal });
          if (res.ok || res.status === 206) {
            return await readBody(res, length, (n) => {
              partial += n;
              onBytes(n);
            });
          }
        } catch (err: any) {
          if (err?.name === 'AbortError' || signal?.aborted) throw err;
          if (partial) onBytes(-partial);
        }
      }

      // Path B: Via Extension
      if (useExtension) {
        try {
          const buf = new Uint8Array(await fetchChunkViaExtension(url, range));
          onBytes(buf.byteLength);
          return buf;
        } catch (extErr) {
          console.warn(`[StreamDownloader] Eklenti parçası başarısız (${range}), yedek deneniyor:`, extErr);
        }
      }

      // Path C: Direct / Custom Proxy fallback
      if (!proxyUrl && useExtension) {
        throw new Error('Video parçası indirilemedi.');
      }
      const proxyTarget = proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;
      const res = await fetch(proxyTarget, { headers: { 'Range': range }, signal });
      if (!res.ok && res.status !== 206) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await readBody(res, length, onBytes);
    };

    try {
      await runAdaptivePool({
        min: RANGE_POOL_MIN,
        max: RANGE_POOL_MAX,
        initial: RANGE_POOL_INITIAL,
        signal,
        label: 'range',
        next: () => {
          if (failed || nextChunkIndex >= chunkCount) return null;
          const index = nextChunkIndex++;
          const start = index * CHUNK_SIZE;
          const end = Math.min(totalBytes - 1, start + CHUNK_SIZE - 1);

          return async (onBytes) => {
            try {
              const data = await withRetry(async () => {
                // Count bytes live for the progress bar; roll back if this attempt fails.
                let received = 0;
                try {
                  return await fetchRange(start, end, (n) => {
                    received += n;
                    totalDownloaded += n;
                    onBytes(n);
                    reportProgress();
                  });
                } catch (err) {
                  totalDownloaded -= received;
                  throw err;
                }
              }, signal);
              await sink.write(start, data);
            } catch (err: any) {
              if (err?.name !== 'AbortError') failed = true;
              throw err;
            }
          };
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) throw abortError();
      console.error('[StreamDownloader] Parça indirme hatası:', err);
      throw new Error('İndirme bağlantısı kesildi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.');
    }

    reportProgress(true);
    onProgress({
      downloadedBytes: totalBytes,
      totalBytes,
      percentage: 100,
      speed: currentSpeed,
      speedFormatted: formatSpeed(currentSpeed),
      etaSeconds: 0,
    });

    return await sink.finish();
  }

  // --- PATH C: FALLBACK SEQUENTIAL (size unknown) ---
  console.warn('[StreamDownloader] Akış boyutu tespit edilemedi (0 bayt), sıralı indirmeye geçiliyor...');
  if (useExtension) {
    const buf = await fetchChunkViaExtension(url, '');
    await sink.write(0, new Uint8Array(buf));
    return await sink.finish();
  }

  const res = await fetch(directOrProxyUrl, { signal });
  if (!res.ok || !res.body) throw new Error('Video akışı başlatılamadı. Lütfen tekrar deneyin.');

  const reader = res.body.getReader();
  let position = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength) {
      await sink.write(position, value);
      position += value.byteLength;
    }
  }

  return await sink.finish();
}

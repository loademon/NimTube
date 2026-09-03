import { 
  isExtensionAvailable, 
  probeSizeViaExtension, 
  fetchChunkViaExtension 
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

// Probe total stream size using Range 0-0
async function probeTotalBytes(targetUrl: string, signal?: AbortSignal): Promise<number> {
  try {
    const probeRes = await fetch(targetUrl, {
      headers: { 'Range': 'bytes=0-0' },
      signal,
    });
    const contentRange = probeRes.headers.get('content-range');
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match) return parseInt(match[1], 10);
    }
    const len = probeRes.headers.get('content-length');
    if (len) return parseInt(len, 10);
  } catch (err) {
    console.warn('Probe size failed:', err);
  }
  return 0;
}

export async function downloadStreamWithProgress(
  url: string,
  proxyUrl: string,
  onProgress: (update: DownloadProgressUpdate) => void,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const useExtension = isExtensionAvailable();
  const directOrProxyUrl = proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;

  // 1. Determine total size
  let totalBytes = 0;
  if (useExtension) {
    totalBytes = await probeSizeViaExtension(url);
  }
  if (!totalBytes) {
    totalBytes = await probeTotalBytes(directOrProxyUrl, signal);
  }

  // --- PARALLEL MULTI-CHUNK TURBO DOWNLOADER ---
  if (totalBytes > 0) {
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

    let startTime = Date.now();
    let lastTime = startTime;
    let lastBytes = 0;
    let currentSpeed = 0;

    let chunkIndex = 0;
    let activeError: Error | null = null;

    // Worker function
    const worker = async () => {
      while (chunkIndex < chunks.length && !activeError) {
        if (signal?.aborted) throw new Error('İndirme iptal edildi.');

        const task = chunks[chunkIndex++];
        if (!task) break;

        const rangeHeader = `bytes=${task.start}-${task.end}`;
        let arrayBuf: ArrayBuffer | null = null;

        // Path A: Direct via Extension (0 Server, 0 CORS, User IP)
        if (useExtension) {
          try {
            arrayBuf = await fetchChunkViaExtension(url, rangeHeader);
          } catch (extErr) {
            console.warn('Extension chunk fetch failed:', extErr);
            arrayBuf = null;
          }
        }

        // Path B: Direct / Custom Proxy fallback
        if (!arrayBuf) {
          const chunkRes = await fetch(directOrProxyUrl, {
            headers: { 'Range': rangeHeader },
            signal,
          });

          if (!chunkRes.ok) {
            throw new Error(`Parça indirilemedi (HTTP ${chunkRes.status})`);
          }

          arrayBuf = await chunkRes.arrayBuffer();
        }

        completeBuffer.set(new Uint8Array(arrayBuf), task.start);
        totalDownloaded += arrayBuf.byteLength;

        // Progress calculation
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        if (timeDiff >= 0.25) {
          const bytesDiff = totalDownloaded - lastBytes;
          currentSpeed = bytesDiff / timeDiff;
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

  // Fallback sequential
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

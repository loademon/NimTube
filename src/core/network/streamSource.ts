import { CustomSource } from 'mediabunny';
import { isExtensionAvailable, fetchChunkViaExtension } from '../extension/extensionBridge';

export interface StreamSourceOptions {
  url: string;
  totalBytes: number;
  proxyUrl?: string;
  signal?: AbortSignal;
  onBytes?: (bytes: number) => void;
  maxCacheSize?: number;
}

function abortError(): Error {
  const err = new Error('İndirme iptal edildi.');
  err.name = 'AbortError';
  return err;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, retries = 3): Promise<T> {
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

export function createStreamSource({
  url,
  totalBytes,
  proxyUrl,
  signal,
  onBytes,
  maxCacheSize = 32 * 1024 * 1024,
}: StreamSourceOptions): CustomSource {
  const useExtension = isExtensionAvailable();
  let canDirectFetch = true;

  const rangeUrl = (start: number, end: number) => {
    const u = new URL(url);
    u.searchParams.set('range', `${start}-${end}`);
    return u.toString();
  };

  const readBody = async (
    res: Response,
    length: number,
    onProgressBytes?: (n: number) => void
  ): Promise<Uint8Array> => {
    if (!res.body) {
      const buf = new Uint8Array(await res.arrayBuffer());
      onProgressBytes?.(buf.byteLength);
      return buf;
    }
    const out = new Uint8Array(length);
    const reader = res.body.getReader();
    let offset = 0;
    try {
      while (true) {
        if (signal?.aborted) {
          reader.cancel().catch(() => {});
          throw abortError();
        }
        const { done, value } = await reader.read();
        if (done) break;
        if (offset + value.byteLength > length) {
          throw new Error('Beklenenden uzun yanıt alındı.');
        }
        out.set(value, offset);
        offset += value.byteLength;
        onProgressBytes?.(value.byteLength);
      }
    } finally {
      reader.releaseLock();
    }
    if (offset !== length) {
      throw new Error(`Eksik parça yanıtı (${offset}/${length} bayt).`);
    }
    return out;
  };

  const fetchRange = async (start: number, end: number): Promise<Uint8Array> => {
    const length = end - start + 1;
    const range = `bytes=${start}-${end}`;

    // Path A: Direct native fetch (CORS headers injected by extension DNR)
    if (canDirectFetch) {
      let partial = 0;
      try {
        const res = await fetch(rangeUrl(start, end), { signal });
        if (res.ok || res.status === 206) {
          return await readBody(res, length, (n) => {
            partial += n;
            onBytes?.(n);
          });
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) throw err;
        if (partial > 0) onBytes?.(-partial);
        // If direct fetch fails on first attempt, fall through to extension/proxy
        canDirectFetch = false;
      }
    }

    // Path B: Extension Bridge
    if (useExtension) {
      try {
        const buf = new Uint8Array(await fetchChunkViaExtension(url, range));
        onBytes?.(buf.byteLength);
        return buf;
      } catch (extErr: any) {
        if (extErr?.name === 'AbortError' || signal?.aborted) throw extErr;
        console.warn(`[StreamSource] Eklenti parçası başarısız (${range}), yedek deneniyor:`, extErr);
      }
    }

    // Path C: Proxy fallback
    if (!proxyUrl && useExtension) {
      throw new Error('Video parçası indirilemedi.');
    }
    const proxyTarget = proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;
    const res = await fetch(proxyTarget, { headers: { Range: range }, signal });
    if (!res.ok && res.status !== 206) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await readBody(res, length, onBytes);
  };

  return new CustomSource({
    getSize: () => totalBytes,
    read: async (start, end) => {
      // In Mediabunny, `end` is exclusive, so the byte range is [start, end - 1]
      const actualEnd = Math.min(totalBytes - 1, end - 1);
      if (start > actualEnd) return new Uint8Array(0);

      return await withRetry(() => fetchRange(start, actualEnd), signal);
    },
    maxCacheSize,
    prefetchProfile: 'network',
  });
}

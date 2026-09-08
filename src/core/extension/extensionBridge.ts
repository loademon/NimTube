export const LATEST_EXTENSION_VERSION = '1.0.6';

export interface ExtensionStatus {
  available: boolean;
  version: string | null;
  outdated: boolean;
  latestVersion: string;
}

let pollingTimer: any = null;

function getInitialStatus(): ExtensionStatus {
  if (typeof window === 'undefined') {
    return {
      available: false,
      version: null,
      outdated: false,
      latestVersion: LATEST_EXTENSION_VERSION,
    };
  }
  try {
    const cachedAvailable = localStorage.getItem('nimtube_ext_available') === 'true';
    const cachedVersion = localStorage.getItem('nimtube_ext_version');
    const outdated = Boolean(
      cachedAvailable && cachedVersion && compareVersions(cachedVersion, LATEST_EXTENSION_VERSION) < 0
    );
    return {
      available: cachedAvailable,
      version: cachedVersion,
      outdated,
      latestVersion: LATEST_EXTENSION_VERSION,
    };
  } catch {
    return {
      available: false,
      version: null,
      outdated: false,
      latestVersion: LATEST_EXTENSION_VERSION,
    };
  }
}

let currentStatus: ExtensionStatus = getInitialStatus();

const listeners = new Set<(available: boolean, status: ExtensionStatus) => void>();

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = v2.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
}

function updateStatus(available: boolean, version: string | null) {
  const outdated = Boolean(
    available && version && compareVersions(version, LATEST_EXTENSION_VERSION) < 0
  );

  const changed =
    currentStatus.available !== available ||
    currentStatus.version !== version ||
    currentStatus.outdated !== outdated;

  currentStatus = {
    available,
    version,
    outdated,
    latestVersion: LATEST_EXTENSION_VERSION,
  };

  if (typeof window !== 'undefined') {
    try {
      if (available) {
        localStorage.setItem('nimtube_ext_available', 'true');
        if (version) localStorage.setItem('nimtube_ext_version', version);
      } else {
        localStorage.removeItem('nimtube_ext_available');
        localStorage.removeItem('nimtube_ext_version');
      }
    } catch {}
  }

  if (changed) {
    listeners.forEach((fn) => {
      try {
        fn(available, currentStatus);
      } catch (err) {
        console.error('Listener error in extensionBridge:', err);
      }
    });
  }
}

// Fast synchronous base64 to ArrayBuffer using lookup table (avoids DOM fetch/data URI lock contention)
const b64Lookup = new Uint8Array(256);
const b64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
for (let i = 0; i < 64; i++) {
  b64Lookup[b64Chars.charCodeAt(i)] = i;
}

export function base64ToArrayBuffer(b64Str: string): ArrayBuffer {
  if (!b64Str) return new ArrayBuffer(0);
  const len = b64Str.length;
  let placeHolders = 0;
  if (b64Str[len - 1] === '=') placeHolders++;
  if (b64Str[len - 2] === '=') placeHolders++;
  const byteLength = (len * 3) / 4 - placeHolders;
  const bytes = new Uint8Array(byteLength);

  let curByte = 0;
  for (let i = 0; i < len; i += 4) {
    const a = b64Lookup[b64Str.charCodeAt(i)];
    const b = b64Lookup[b64Str.charCodeAt(i + 1)];
    const c = b64Lookup[b64Str.charCodeAt(i + 2)];
    const d = b64Lookup[b64Str.charCodeAt(i + 3)];

    bytes[curByte++] = (a << 2) | (b >> 4);
    if (curByte < byteLength) bytes[curByte++] = ((b & 15) << 4) | (c >> 2);
    if (curByte < byteLength) bytes[curByte++] = ((c & 3) << 6) | (d & 63);
  }
  return bytes.buffer;
}

const pendingRequests = new Map<string, {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  timeout: any;
}>();

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || !event.data) return;
    const { source, requestId } = event.data;
    if (source !== 'nimtube-extension' || !requestId) return;

    const pending = pendingRequests.get(requestId);
    if (!pending) return;

    pendingRequests.delete(requestId);
    clearTimeout(pending.timeout);

    if (event.data.success) {
      pending.resolve(event.data);
    } else {
      pending.reject(new Error(event.data.error || 'Eklenti işlemi başarısız oldu.'));
    }
  });
}

function sendExtensionRequest(type: string, payload: any, timeoutMs = 25000): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).substring(2, 10);
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Eklenti yanıt vermedi (Zaman aşımı).'));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    window.postMessage(
      {
        source: 'nimtube-client',
        requestId,
        type,
        payload,
      },
      '*'
    );
  });
}

export async function checkExtensionAvailability(): Promise<boolean> {
  try {
    const res = await sendExtensionRequest('PING', {}, 900);
    const isOk = Boolean(res && res.success);
    const ver = res?.version || currentStatus.version;
    updateStatus(isOk, ver);
    return isOk;
  } catch {
    if (currentStatus.available) {
      updateStatus(false, null);
    }
    return false;
  }
}

export function startExtensionPolling(intervalMs = 1500) {
  if (typeof window === 'undefined') return;
  if (pollingTimer) return;

  // Initial immediate check
  checkExtensionAvailability();

  pollingTimer = setInterval(() => {
    checkExtensionAvailability();
  }, intervalMs);
}

export function stopExtensionPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

export function isExtensionAvailable(): boolean {
  return currentStatus.available;
}

export function getExtensionStatus(): ExtensionStatus {
  return currentStatus;
}

export function subscribeExtensionStatus(
  callback: (available: boolean, status: ExtensionStatus) => void
): () => void {
  listeners.add(callback);
  callback(currentStatus.available, currentStatus);
  return () => listeners.delete(callback);
}

// Global listener for extension announcements and continuous polling
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.source === 'nimtube-extension' && event.data.type === 'EXTENSION_READY') {
      const ver = event.data.version || null;
      updateStatus(true, ver);
    }
  });

  // Start continuous polling immediately
  startExtensionPolling(1500);
}

// 1. Resolve YouTube video directly through user IP via extension
export async function resolveVideoViaExtension(videoId: string): Promise<any> {
  const res = await sendExtensionRequest('RESOLVE_YOUTUBE', { videoId });
  return res.data;
}

export interface StreamProbeResult {
  totalBytes: number;
  isSegmented: boolean;
  headSeqNum: number;
}

// 2. Probe content length or sequence count via extension
export async function probeStreamViaExtension(url: string, timeoutMs = 8000): Promise<StreamProbeResult> {
  try {
    const res = await sendExtensionRequest('PROBE_SIZE', { url }, timeoutMs);
    const headSeq = res.headSeqNum ? parseInt(res.headSeqNum, 10) : 0;
    const isLiveNoclen = url.includes('noclen=1') || url.includes('source=yt_live_broadcast') || url.includes('live=1');

    if (headSeq > 0 || isLiveNoclen || res.contentRange?.endsWith('/1')) {
      return {
        totalBytes: 0,
        isSegmented: true,
        headSeqNum: headSeq || (res.seqNum ? parseInt(res.seqNum, 10) : 0),
      };
    }

    if (res.contentRange) {
      const match = res.contentRange.match(/\/(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > 1) {
          return { totalBytes: val, isSegmented: false, headSeqNum: 0 };
        }
      }
    }

    if (res.contentLength) {
      const len = parseInt(res.contentLength, 10);
      if (len > 1) {
        return { totalBytes: len, isSegmented: false, headSeqNum: 0 };
      }
    }
  } catch (err) {
    console.warn('Extension probe size failed:', err);
  }
  return { totalBytes: 0, isSegmented: false, headSeqNum: 0 };
}

export async function probeSizeViaExtension(url: string): Promise<number> {
  const info = await probeStreamViaExtension(url);
  return info.totalBytes;
}

// 3. Fetch Range chunk via extension
export async function fetchChunkViaExtension(url: string, range: string): Promise<ArrayBuffer> {
  const res = await sendExtensionRequest('FETCH_CHUNK', { url, range }, 45000);
  if (res.base64 === undefined || res.base64 === null) {
    throw new Error(res.error || 'Eklentiden veri döndürülemedi.');
  }
  if (!res.base64) {
    return new ArrayBuffer(0);
  }
  return base64ToArrayBuffer(res.base64);
}

// 4. Turbo Parallel Batch Fetch for DASH Segments
export async function fetchSegmentBatchViaExtension(
  baseUrl: string,
  startSq: number,
  count: number
): Promise<ArrayBuffer> {
  const res = await sendExtensionRequest(
    'FETCH_SEGMENT_BATCH',
    { baseUrl, startSq, count },
    60000
  );
  if (res.base64 === undefined || res.base64 === null) {
    throw new Error(res.error || 'Eklentiden toplu veri alınamadı.');
  }
  if (!res.base64) {
    return new ArrayBuffer(0);
  }
  return base64ToArrayBuffer(res.base64);
}

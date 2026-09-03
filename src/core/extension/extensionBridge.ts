// NimTube Client-Side Extension Bridge

export const LATEST_EXTENSION_VERSION = '1.0.4';

export interface ExtensionStatus {
  available: boolean;
  version: string | null;
  outdated: boolean;
  latestVersion: string;
}

let pollingTimer: any = null;

let currentStatus: ExtensionStatus = {
  available: false,
  version: null,
  outdated: false,
  latestVersion: LATEST_EXTENSION_VERSION,
};

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

// Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function sendExtensionRequest(type: string, payload: any, timeoutMs = 25000): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).substring(2, 10);
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      reject(new Error('Eklenti yanıt vermedi (Zaman aşımı).'));
    }, timeoutMs);

    function handleResponse(event: MessageEvent) {
      if (event.source !== window || !event.data) return;
      if (event.data.source === 'nimtube-extension' && event.data.requestId === requestId) {
        clearTimeout(timeout);
        window.removeEventListener('message', handleResponse);
        if (event.data.success) {
          resolve(event.data);
        } else {
          reject(new Error(event.data.error || 'Eklenti işlemi başarısız oldu.'));
        }
      }
    }

    window.addEventListener('message', handleResponse);
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

// 2. Probe content length via extension
export async function probeSizeViaExtension(url: string): Promise<number> {
  try {
    const res = await sendExtensionRequest('PROBE_SIZE', { url });
    if (res.contentRange) {
      const match = res.contentRange.match(/\/(\d+)$/);
      if (match) return parseInt(match[1], 10);
    }
    if (res.contentLength) {
      return parseInt(res.contentLength, 10);
    }
  } catch (err) {
    console.warn('Extension probe size failed:', err);
  }
  return 0;
}

// 3. Fetch Range chunk via extension
export async function fetchChunkViaExtension(url: string, range: string): Promise<ArrayBuffer> {
  const res = await sendExtensionRequest('FETCH_CHUNK', { url, range }, 45000);
  if (!res.base64) {
    throw new Error('Eklentiden boş veri döndü.');
  }
  return base64ToArrayBuffer(res.base64);
}

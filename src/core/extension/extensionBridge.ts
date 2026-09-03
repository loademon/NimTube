// NimTube Client-Side Extension Bridge

let extensionAvailable = false;
const listeners = new Set<(available: boolean) => void>();

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

// Global listener for extension announcements
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.source === 'nimtube-extension' && event.data.type === 'EXTENSION_READY') {
      if (!extensionAvailable) {
        extensionAvailable = true;
        listeners.forEach((fn) => fn(true));
      }
    }
  });

  // Initial check
  setTimeout(() => {
    checkExtensionAvailability();
  }, 100);
}

export function isExtensionAvailable(): boolean {
  return extensionAvailable;
}

export function subscribeExtensionStatus(callback: (available: boolean) => void): () => void {
  listeners.add(callback);
  callback(extensionAvailable);
  return () => listeners.delete(callback);
}

export async function checkExtensionAvailability(): Promise<boolean> {
  try {
    const res = await sendExtensionRequest('PING', {});
    const isOk = Boolean(res && res.success);
    if (extensionAvailable !== isOk) {
      extensionAvailable = isOk;
      listeners.forEach((fn) => fn(isOk));
    }
    return isOk;
  } catch {
    if (extensionAvailable) {
      extensionAvailable = false;
      listeners.forEach((fn) => fn(false));
    }
    return false;
  }
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
    window.postMessage({
      source: 'nimtube-client',
      requestId,
      type,
      payload,
    }, '*');
  });
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

// NimTube Bridge Background Service Worker (Manifest V3)

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const CHUNK = 32768;
  for (let i = 0; i < len; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, len));
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
}

// Setup Context Menus on Install or Startup
function setupContextMenu() {
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'nimtube-download',
        title: 'NimTube ile İndir',
        contexts: ['link', 'video', 'page'],
        documentUrlPatterns: ['*://*.youtube.com/*'],
      });
    });
  }
}

function injectContentScriptIntoOpenTabs() {
  if (!chrome.tabs || !chrome.scripting) return;
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      if (
        tab.url.includes('nimtube.2615.us') ||
        tab.url.includes('localhost:') ||
        tab.url.includes('127.0.0.1:')
      ) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        }).catch(() => {});
      }
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  injectContentScriptIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

const DEFAULT_APP_URL = 'https://nimtube.2615.us';

// Handle Context Menu Clicks
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'nimtube-download') {
      const rawUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url || '';
      const match = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      
      chrome.storage?.local?.get(['nimtubeAppUrl'], (res) => {
        const baseUrl = (res && res.nimtubeAppUrl) ? res.nimtubeAppUrl : DEFAULT_APP_URL;
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        let openUrl = cleanBase;
        if (match) {
          openUrl += `?v=${match[1]}`;
        } else if (rawUrl.startsWith('http')) {
          openUrl += `?url=${encodeURIComponent(rawUrl)}`;
        }
        chrome.tabs.create({ url: openUrl });
      });
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'PING') {
        const ver = chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '1.0.7';
        sendResponse({ success: true, version: ver });
        return;
      }

      // 1. YouTube Video & Stream Resolution
      if (message.type === 'RESOLVE_YOUTUBE') {
        const { videoId } = message.payload;
        if (!videoId) {
          sendResponse({ success: false, error: 'Eksik video ID.' });
          return;
        }

        // Step 1: Request watch page HTML to establish session and visitor tokens
        let apiKey = atob('QUl6YVN5QU9fRkoyU2xxVThRNFNURUhMR0NpbHdfWTlfMTFxY1c4');
        let visitorData = '';

        try {
          const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
          const pageRes = await fetch(watchUrl, {
            headers: {
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });

          const html = await pageRes.text();
          const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
          if (apiKeyMatch) apiKey = apiKeyMatch[1];

          const visitorMatch = html.match(/"visitorData":"([^"]+)"/);
          if (visitorMatch) visitorData = visitorMatch[1];
        } catch (watchErr) {
          console.warn('Watch page handshake failed, using direct key:', watchErr);
        }

        // Step 2: Request Player API using VisionOS persona
        const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`;
        
        const makePlayerReq = async (clientName, clientVersion, extraContext = {}) => {
          return await fetch(playerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': clientName === 'VISIONOS' ? '101' : '55',
              'X-YouTube-Client-Version': clientVersion,
              'X-Goog-Visitor-Id': visitorData,
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName,
                  clientVersion,
                  visitorData,
                  hl: 'en',
                  gl: 'US',
                  ...extraContext,
                },
              },
              videoId: videoId,
              contentCheckOk: true,
              racyCheckOk: true,
            }),
          });
        };

        // Primary: VisionOS (Client 101)
        let playerRes = await makePlayerReq('VISIONOS', '1.02', {
          deviceMake: 'Apple',
          deviceModel: 'RealityDevice17,1',
          osName: 'visionOS',
          osVersion: '26.5.23O471',
        });

        const contentType = playerRes.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          // Fallback to ANDROID_VR if VisionOS receives HTML
          playerRes = await makePlayerReq('ANDROID_VR', '1.56.21', {
            deviceMake: 'Oculus',
            deviceModel: 'Quest 3',
            osName: 'Android',
            osVersion: '12',
          });
        }

        const resText = await playerRes.text();
        let data;
        try {
          data = JSON.parse(resText);
        } catch (jsonErr) {
          throw new Error(`YouTube API beklenmeyen yanıt döndürdü (HTTP ${playerRes.status}): ${resText.slice(0, 150)}`);
        }

        if (data.playabilityStatus?.status && data.playabilityStatus.status !== 'OK') {
          throw new Error(data.playabilityStatus.reason || 'Video oynatılamıyor.');
        }

        sendResponse({ success: true, data });
        return;
      }

      // 2. Size Probe using Range 0-0
      if (message.type === 'PROBE_SIZE') {
        const { url } = message.payload;
        try {
          const probeRes = await fetch(url, {
            headers: {
              'Range': 'bytes=0-0',
            },
          });

          const contentRange = probeRes.headers.get('content-range');
          const contentLength = probeRes.headers.get('content-length');
          let headSeqNum = probeRes.headers.get('x-head-seqnum');
          let seqNum = probeRes.headers.get('x-sequence-num');
          const contentType = probeRes.headers.get('content-type');

          // If it's a live/segmented stream and headSeqNum was not on bytes=0-0 probe, try sq=0
          if (!headSeqNum && (url.includes('noclen=1') || url.includes('source=yt_live_broadcast') || contentRange?.endsWith('/1'))) {
            try {
              const u0 = new URL(url);
              u0.searchParams.set('sq', '0');
              const sqRes = await fetch(u0.toString());
              headSeqNum = sqRes.headers.get('x-head-seqnum');
              if (!seqNum) seqNum = sqRes.headers.get('x-sequence-num');
            } catch {}
          }

          sendResponse({
            success: true,
            status: probeRes.status,
            contentRange,
            contentLength,
            headSeqNum,
            seqNum,
            contentType,
          });
          return;
        } catch (probeErr) {
          sendResponse({ success: false, error: probeErr?.message || 'Probe hatası' });
          return;
        }
      }

      // 3. Parallel Range Chunk Fetch
      if (message.type === 'FETCH_CHUNK') {
        const { url, range } = message.payload;
        const headers = {};
        if (range) headers['Range'] = range;

        const res = await fetch(url, { headers });
        if (!res.ok) {
          if (res.status === 204) {
            // End of stream segment (No content)
            sendResponse({
              success: true,
              base64: '',
              byteLength: 0,
              status: 204,
            });
            return;
          }
          sendResponse({ success: false, error: `HTTP ${res.status}` });
          return;
        }

        const buffer = await res.arrayBuffer();
        const base64Data = arrayBufferToBase64(buffer);

        sendResponse({
          success: true,
          base64: base64Data,
          byteLength: buffer.byteLength,
          status: res.status,
        });
        return;
      }

      // 4. Turbo Segment Batch Fetch (Downloads N segments concurrently in Service Worker and merges them)
      if (message.type === 'FETCH_SEGMENT_BATCH') {
        const { baseUrl, startSq, count } = message.payload;

        const fetchOne = async (sq) => {
          let retries = 2;
          while (retries >= 0) {
            try {
              const u = new URL(baseUrl);
              u.searchParams.set('sq', String(sq));
              const res = await fetch(u.toString());
              if (!res.ok) {
                if (res.status === 204) return new Uint8Array(0);
                throw new Error(`HTTP ${res.status}`);
              }
              const buf = await res.arrayBuffer();
              return new Uint8Array(buf);
            } catch (err) {
              retries--;
              if (retries < 0) throw err;
              await new Promise((r) => setTimeout(r, 200));
            }
          }
          return new Uint8Array(0);
        };

        const promises = [];
        for (let i = 0; i < count; i++) {
          promises.push(fetchOne(startSq + i));
        }

        const chunks = await Promise.all(promises);
        let totalLen = 0;
        for (const c of chunks) totalLen += c.byteLength;

        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }

        const base64Data = arrayBufferToBase64(merged.buffer);
        sendResponse({
          success: true,
          base64: base64Data,
          byteLength: totalLen,
          startSq,
          count,
        });
        return;
      }

      sendResponse({ success: false, error: 'Bilinmeyen istek türü' });
    } catch (err) {
      sendResponse({ success: false, error: err?.message || 'Bilinmeyen hata' });
    }
  })();

  return true;
});

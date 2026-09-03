// NimTube Bridge Minimal Popup Script

const DEFAULT_APP_URL = 'https://nimtube.2615.us';

document.addEventListener('DOMContentLoaded', async () => {
  const ytWrap = document.getElementById('yt-wrap');
  const defaultWrap = document.getElementById('default-wrap');
  const videoName = document.getElementById('video-name');
  const dlBtn = document.getElementById('dl-btn');
  const openBtn = document.getElementById('open-btn');

  let baseUrl = DEFAULT_APP_URL;
  try {
    const res = await chrome.storage.local.get(['nimtubeAppUrl']);
    if (res?.nimtubeAppUrl) baseUrl = res.nimtubeAppUrl;
  } catch (e) {}
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const match = tab.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      if (match) {
        ytWrap.style.display = 'block';
        defaultWrap.style.display = 'none';
        videoName.textContent = tab.title ? tab.title.replace(' - YouTube', '') : 'YouTube Videosu';
        
        dlBtn.addEventListener('click', () => {
          chrome.tabs.create({ url: `${cleanBase}?v=${match[1]}` });
        });
        return;
      }
    }
  } catch (e) {
    console.warn(e);
  }

  openBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: cleanBase });
  });
});

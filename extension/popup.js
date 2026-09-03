// NimTube Bridge Minimal Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const ytWrap = document.getElementById('yt-wrap');
  const defaultWrap = document.getElementById('default-wrap');
  const videoName = document.getElementById('video-name');
  const dlBtn = document.getElementById('dl-btn');
  const openBtn = document.getElementById('open-btn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const match = tab.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      if (match) {
        ytWrap.style.display = 'block';
        defaultWrap.style.display = 'none';
        videoName.textContent = tab.title ? tab.title.replace(' - YouTube', '') : 'YouTube Videosu';
        
        dlBtn.addEventListener('click', () => {
          chrome.tabs.create({ url: `http://localhost:5173/?v=${match[1]}` });
        });
        return;
      }
    }
  } catch (e) {
    console.warn(e);
  }

  openBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173/' });
  });
});

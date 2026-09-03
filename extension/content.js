// NimTube Bridge Content Script (Manifest V3)

// If running on a NimTube host, save the origin for context-menu redirects
if (
  window.location.hostname.includes('2615.us') ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
) {
  try {
    chrome.storage?.local?.set({ nimtubeAppUrl: window.location.origin });
  } catch (e) {}
}

function getExtensionVersion() {
  try {
    return chrome.runtime.getManifest().version;
  } catch (e) {
    return '1.0.4';
  }
}

// Announce presence to the web application
function notifyReady() {
  window.postMessage({
    source: 'nimtube-extension',
    type: 'EXTENSION_READY',
    version: getExtensionVersion(),
  }, '*');
}

notifyReady();
document.addEventListener('DOMContentLoaded', notifyReady);

// Forward requests from web app to extension service worker
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'nimtube-client') return;

  const { requestId, type, payload } = event.data;

  // Instant response for PING
  if (type === 'PING') {
    window.postMessage({
      source: 'nimtube-extension',
      requestId,
      success: true,
      version: getExtensionVersion(),
    }, '*');
    return;
  }

  chrome.runtime.sendMessage({ type, payload }, (response) => {
    if (chrome.runtime.lastError) {
      window.postMessage({
        source: 'nimtube-extension',
        requestId,
        success: false,
        error: chrome.runtime.lastError.message,
      }, '*');
      return;
    }

    window.postMessage({
      source: 'nimtube-extension',
      requestId,
      ...response,
    }, '*');
  });
});

// --- YouTube Native In-Player Context Menu Injection ---
if (window.location.hostname.includes('youtube.com')) {
  // Inject dedicated soft pastel translucent styles
  function ensureStyles() {
    if (document.getElementById('nimtube-yt-styles')) return;
    const style = document.createElement('style');
    style.id = 'nimtube-yt-styles';
    style.textContent = `
      .nimtube-injected-item {
        background-color: rgba(239, 68, 68, 0.12) !important;
        border: 1px solid rgba(239, 68, 68, 0.22) !important;
        border-radius: 8px !important;
        margin: 4px 6px 6px 6px !important;
        transition: all 0.15s ease !important;
        cursor: pointer !important;
        user-select: none !important;
      }
      .nimtube-injected-item:hover {
        background-color: rgba(239, 68, 68, 0.22) !important;
        border-color: rgba(239, 68, 68, 0.38) !important;
      }
      .nimtube-injected-item:active {
        background-color: rgba(239, 68, 68, 0.30) !important;
        transform: scale(0.985) !important;
      }
      .nimtube-injected-item .ytp-menuitem-icon {
        display: table-cell !important;
        vertical-align: middle !important;
        padding-left: 10px !important;
        width: 24px !important;
      }
      .nimtube-injected-item .ytp-menuitem-icon svg {
        display: block !important;
        fill: #fca5a5 !important;
        width: 18px !important;
        height: 18px !important;
        transition: fill 0.15s ease !important;
      }
      .nimtube-injected-item:hover .ytp-menuitem-icon svg {
        fill: #fecdd3 !important;
      }
      .nimtube-injected-item .ytp-menuitem-label {
        display: table-cell !important;
        vertical-align: middle !important;
        padding-left: 12px !important;
        padding-right: 14px !important;
        color: #fecdd3 !important;
        font-weight: 500 !important;
        font-size: 13px !important;
        letter-spacing: -0.01em !important;
        transition: color 0.15s ease !important;
      }
      .nimtube-injected-item:hover .ytp-menuitem-label {
        color: #ffffff !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  ensureStyles();

  function injectNimTubeMenuItem() {
    ensureStyles();
    const menus = document.querySelectorAll('.ytp-contextmenu .ytp-panel-menu');
    menus.forEach((menu) => {
      if (menu.querySelector('.nimtube-injected-item')) return;

      const item = document.createElement('div');
      item.className = 'ytp-menuitem nimtube-injected-item';
      item.setAttribute('role', 'menuitem');
      item.setAttribute('tabindex', '0');

      const icon = document.createElement('div');
      icon.className = 'ytp-menuitem-icon';
      icon.innerHTML = `<svg height="18" viewBox="0 0 24 24" width="18"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;

      const label = document.createElement('div');
      label.className = 'ytp-menuitem-label';
      label.textContent = 'NimTube ile İndir';

      const content = document.createElement('div');
      content.className = 'ytp-menuitem-content';

      item.appendChild(icon);
      item.appendChild(label);
      item.appendChild(content);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Close YouTube's context menu
        const popup = menu.closest('.ytp-contextmenu') || menu.closest('.ytp-popup');
        if (popup) {
          popup.style.display = 'none';
        }

        const url = window.location.href;
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
        
        chrome.storage?.local?.get(['nimtubeAppUrl'], (res) => {
          const baseUrl = (res && res.nimtubeAppUrl) ? res.nimtubeAppUrl : 'https://nimtube.2615.us';
          const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
          const targetUrl = match 
            ? `${cleanBase}?v=${match[1]}` 
            : `${cleanBase}?url=${encodeURIComponent(url)}`;

          window.open(targetUrl, '_blank');
        });
      });

      // Insert at the very top of YouTube's context menu
      menu.insertBefore(item, menu.firstChild);
    });
  }

  // Listen on right click inside YouTube player
  document.addEventListener('contextmenu', () => {
    setTimeout(injectNimTubeMenuItem, 20);
    setTimeout(injectNimTubeMenuItem, 80);
    setTimeout(injectNimTubeMenuItem, 200);
  }, true);

  // Observer for dynamic menu creations
  const observer = new MutationObserver(() => {
    const contextmenu = document.querySelector('.ytp-contextmenu');
    if (contextmenu && contextmenu.style.display !== 'none') {
      injectNimTubeMenuItem();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });
}

// Web Worker for extracting YouTube videos using InnerTube API
import type { VideoInfo } from '../types';
import { parseInnertubeOutput } from './innertubeParser';

async function extractVideo(url: string, proxyUrl: string): Promise<VideoInfo> {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (!match) {
    throw new Error('Geçerli bir YouTube video veya Shorts bağlantısı girin.');
  }
  const videoId = match[1];

  // Secondary External Endpoint (Public YouTube Innertube client key)
  const apiKey = atob('QUl6YVN5QU9fRkoyU2xxVThRNFNURUhMR0NpbHdfWTlfMTFxY1c4');
  const directApiUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`;
  const targetEndpoint = proxyUrl 
    ? `${proxyUrl}${encodeURIComponent(directApiUrl)}`
    : `https://corsproxy.io/?url=${encodeURIComponent(directApiUrl)}`;

  const res = await fetch(targetEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '55',
      'X-YouTube-Client-Version': '1.56.21',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'ANDROID_VR',
          clientVersion: '1.56.21',
          deviceMake: 'Oculus',
          deviceModel: 'Quest 3',
          osName: 'Android',
          osVersion: '12',
          hl: 'tr',
          gl: 'TR',
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });

  if (!res.ok) {
    throw new Error('Video bilgileri alınamadı. Lütfen bağlantıyı kontrol edin.');
  }

  const data = await res.json();
  if (data.playabilityStatus?.status !== 'OK') {
    throw new Error(data.playabilityStatus?.reason || 'Bu video gizli, yaş kısıtlamalı veya kullanılamıyor olabilir.');
  }

  return parseInnertubeOutput(data, videoId, url);
}

// Listen to main thread messages
self.onmessage = async (e: MessageEvent) => {
  const { action, payload, id } = e.data;

  if (action === 'extract') {
    const { url, proxyUrl } = payload;
    self.postMessage({ type: 'status', message: 'Video bilgileri alınıyor...' });

    try {
      const videoInfo = await extractVideo(url, proxyUrl);
      self.postMessage({ id, type: 'extract_success', data: videoInfo });
    } catch (err: any) {
      self.postMessage({ 
        id, 
        type: 'extract_error', 
        error: err?.message || 'Video bilgileri alınamadı. Lütfen bağlantıyı kontrol edin.' 
      });
    }
  }
};

import type { VideoInfo, VideoFormat, SubtitleTrack } from '../types';

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes?: number): string | undefined {
  if (!bytes || isNaN(bytes)) return undefined;
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function formatViewCount(views?: number): string {
  if (!views || isNaN(views)) return '0';
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toLocaleString();
}

export function parseInnertubeOutput(data: any, videoId: string, originalUrl: string): VideoInfo {
  const videoDetails = data.videoDetails || {};
  const streamingData = data.streamingData || {};

  const formats: VideoFormat[] = [];
  const audioFormats: VideoFormat[] = [];

  const rawFormats = [
    ...(streamingData.formats || []),
    ...(streamingData.adaptiveFormats || [])
  ];

  const audioStreams = rawFormats.filter((f: any) => f.mimeType?.startsWith('audio/'));
  audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
  const bestAudioStream = audioStreams[0];

  for (const f of rawFormats) {
    if (!f.url) continue;

    const isVideo = f.mimeType?.startsWith('video/');
    const isAudio = f.mimeType?.startsWith('audio/');
    const isAdaptive = isVideo && !f.audioQuality;

    const formatObj: VideoFormat = {
      formatId: String(f.itag),
      qualityLabel: f.qualityLabel || (isAudio ? `${Math.round((f.bitrate || 128000) / 1000)} kbps` : `${f.height || 360}p`),
      resolution: f.width && f.height ? `${f.width}x${f.height}` : undefined,
      fps: f.fps,
      ext: f.mimeType?.includes('webm') ? 'webm' : (isAudio ? 'm4a' : 'mp4'),
      filesize: f.contentLength ? parseInt(f.contentLength, 10) : undefined,
      filesizeFormatted: formatBytes(f.contentLength ? parseInt(f.contentLength, 10) : undefined),
      videoCodec: f.mimeType?.split('codecs="')?.[1]?.split('"')?.[0],
      hasVideo: isVideo,
      hasAudio: isAudio || Boolean(f.audioQuality),
      isAdaptive: isAdaptive,
      url: f.url,
      audioUrl: isAdaptive && bestAudioStream ? bestAudioStream.url : undefined,
      audioFormatId: isAdaptive && bestAudioStream ? String(bestAudioStream.itag) : undefined,
      bitrate: f.bitrate,
    };

    if (isVideo) {
      formats.push(formatObj);
    } else if (isAudio) {
      audioFormats.push(formatObj);
    }
  }

  formats.sort((a, b) => {
    const resA = parseInt(a.qualityLabel) || 0;
    const resB = parseInt(b.qualityLabel) || 0;
    return resB - resA;
  });

  const durationSec = parseInt(videoDetails.lengthSeconds || '0', 10);

  return {
    id: videoId,
    title: videoDetails.title || 'YouTube Video',
    channel: videoDetails.author || 'YouTube Kanalı',
    channelUrl: `https://www.youtube.com/channel/${videoDetails.channelId}`,
    duration: durationSec,
    durationFormatted: formatDuration(durationSec),
    viewCount: parseInt(videoDetails.viewCount || '0', 10),
    viewCountFormatted: formatViewCount(parseInt(videoDetails.viewCount || '0', 10)),
    uploadDate: new Date().toLocaleDateString('tr-TR'),
    thumbnailUrl: videoDetails.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: videoDetails.shortDescription || '',
    formats,
    audioFormats,
    subtitles: [],
    originalUrl,
  };
}

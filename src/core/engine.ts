import type { 
  VideoInfo, 
  VideoFormat, 
  SubtitleTrack, 
  DownloadProgress, 
  AppSettings 
} from './types';
import { downloadStreamWithProgress } from './network/streamDownloader';
import { saveFileToDisk, sanitizeFilename } from './storage/fileSaver';
import { isExtensionAvailable, resolveVideoViaExtension } from './extension/extensionBridge';
import { parseInnertubeOutput } from './extractor/innertubeParser';

class NimTubeEngine {
  private ytdlpWorker: Worker | null = null;
  private ffmpegWorker: Worker | null = null;
  private abortController: AbortController | null = null;
  private messageCallbacks = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor() {
    this.initWorkers();
  }

  public initWorkers() {
    // 1. Initialize Pyodide yt-dlp Worker
    if (!this.ytdlpWorker) {
      try {
        this.ytdlpWorker = new Worker(
          new URL('./extractor/ytdlpWorker.ts', import.meta.url),
          { type: 'module' }
        );

        this.ytdlpWorker.onmessage = (e) => {
          const { id, type, data, error } = e.data;
          if (id && this.messageCallbacks.has(id)) {
            const { resolve, reject } = this.messageCallbacks.get(id)!;
            this.messageCallbacks.delete(id);
            if (type.endsWith('_error')) {
              reject(new Error(error || 'Worker hatası'));
            } else {
              resolve(data);
            }
          }
        };

        // Trigger background init
        this.ytdlpWorker.postMessage({ action: 'init' });
      } catch (err) {
        console.warn('yt-dlp worker init error:', err);
      }
    }
  }

  // Lazy-load FFmpeg WebAssembly worker only when needed (saves 10MB WASM bandwidth on page load)
  private ensureFFmpegWorker(): Worker {
    if (!this.ffmpegWorker) {
      try {
        this.ffmpegWorker = new Worker(
          new URL('./muxer/ffmpegWorker.ts', import.meta.url),
          { type: 'module' }
        );

        this.ffmpegWorker.onmessage = (e) => {
          const { id, type, buffer, error } = e.data;
          if (id && this.messageCallbacks.has(id)) {
            const { resolve, reject } = this.messageCallbacks.get(id)!;
            this.messageCallbacks.delete(id);
            if (type.endsWith('_error')) {
              reject(new Error(error || 'FFmpeg işlemi başarısız'));
            } else {
              resolve(buffer);
            }
          }
        };
      } catch (err) {
        console.error('FFmpeg worker creation error:', err);
        throw new Error('FFmpeg WebAssembly motoru başlatılamadı.');
      }
    }
    return this.ffmpegWorker;
  }

  private sendWorkerMessage(worker: Worker, action: string, payload: any, transfer: Transferable[] = []): Promise<any> {
    const id = Math.random().toString(36).substring(2, 9);
    return new Promise((resolve, reject) => {
      this.messageCallbacks.set(id, { resolve, reject });
      worker.postMessage({ id, action, payload }, transfer);
    });
  }

  // Extract video info and formats
  public async extractInfo(url: string, settings: AppSettings): Promise<VideoInfo> {
    // 1. If Chrome extension bridge is active, resolve directly from user browser (0 server, 0 CORS)
    if (isExtensionAvailable()) {
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      if (match) {
        const videoId = match[1];
        try {
          const rawData = await resolveVideoViaExtension(videoId);
          if (rawData && rawData.streamingData && rawData.playabilityStatus?.status === 'OK') {
            return parseInnertubeOutput(rawData, videoId, url);
          }
        } catch (extErr) {
          console.warn('Extension extraction failed, falling back:', extErr);
        }
      }
    }

    // 2. Fallback to local / worker resolution
    if (!this.ytdlpWorker) {
      this.initWorkers();
    }
    
    return await this.sendWorkerMessage(this.ytdlpWorker!, 'extract', {
      url,
      proxyUrl: settings.corsProxyUrl,
    });
  }

  // Download Video (Progressive or Adaptive 1080p/4K with FFmpeg Muxing)
  public async downloadVideo(
    videoInfo: VideoInfo,
    format: VideoFormat,
    settings: AppSettings,
    onProgress: (p: DownloadProgress) => void
  ): Promise<boolean> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      if (!format.isAdaptive) {
        // --- 1. SINGLE STREAM DIRECT DOWNLOAD (e.g. 720p / 360p) ---
        onProgress({
          stage: 'downloading_video',
          percentage: 0,
          downloadedBytes: 0,
          totalBytes: format.filesize || 0,
          speed: 0,
          speedFormatted: '0 MB/s',
          etaSeconds: 0,
          statusMessage: `${format.qualityLabel} video akışı indiriliyor...`,
        });

        const videoBuffer = await downloadStreamWithProgress(
          format.url,
          settings.corsProxyUrl,
          (prog) => {
            onProgress({
              stage: 'downloading_video',
              percentage: prog.percentage,
              downloadedBytes: prog.downloadedBytes,
              totalBytes: prog.totalBytes,
              speed: prog.speed,
              speedFormatted: prog.speedFormatted,
              etaSeconds: prog.etaSeconds,
              statusMessage: `${format.qualityLabel} indiriliyor: %${prog.percentage} (${prog.speedFormatted})`,
            });
          },
          signal
        );

        onProgress({
          stage: 'saving',
          percentage: 100,
          downloadedBytes: videoBuffer.byteLength,
          totalBytes: videoBuffer.byteLength,
          speed: 0,
          speedFormatted: '',
          etaSeconds: 0,
          statusMessage: 'Dosya diske kaydediliyor...',
        });

        const filename = `${sanitizeFilename(videoInfo.title)} [${format.qualityLabel}].${format.ext || 'mp4'}`;
        await saveFileToDisk({
          filename,
          mimeType: format.ext === 'webm' ? 'video/webm' : 'video/mp4',
          data: videoBuffer,
          useFileSystemAccess: settings.useFileSystemAccess,
        });

      } else {
        // --- 2. ADAPTIVE DASH STREAMS (1080p, 1440p, 4K -> Video + Audio Muxing) ---
        
        // Find matching best audio stream
        let audioUrl = format.audioUrl;
        if (!audioUrl) {
          const bestAudio = videoInfo.audioFormats[0] || videoInfo.formats.find(f => f.hasAudio && !f.hasVideo);
          audioUrl = bestAudio?.url;
        }

        if (!audioUrl) {
          throw new Error('Videoya ait uygun ses akışı bulunamadı.');
        }

        // Stage 1: Download Video Track (0 - 50% overall weight)
        onProgress({
          stage: 'downloading_video',
          percentage: 0,
          downloadedBytes: 0,
          totalBytes: format.filesize || 0,
          speed: 0,
          speedFormatted: '0 MB/s',
          etaSeconds: 0,
          statusMessage: `${format.qualityLabel} video parçası indiriliyor...`,
        });

        const videoBuffer = await downloadStreamWithProgress(
          format.url,
          settings.corsProxyUrl,
          (prog) => {
            const scaledPercent = Math.round(prog.percentage * 0.5);
            onProgress({
              stage: 'downloading_video',
              percentage: scaledPercent,
              downloadedBytes: prog.downloadedBytes,
              totalBytes: prog.totalBytes,
              speed: prog.speed,
              speedFormatted: prog.speedFormatted,
              etaSeconds: prog.etaSeconds,
              statusMessage: `Görüntü akışı indiriliyor: %${prog.percentage} (${prog.speedFormatted})`,
            });
          },
          signal
        );

        // Stage 2: Download Audio Track (50% - 80% overall weight)
        onProgress({
          stage: 'downloading_audio',
          percentage: 50,
          downloadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          speedFormatted: '0 MB/s',
          etaSeconds: 0,
          statusMessage: `Yüksek kaliteli ses parçası indiriliyor...`,
        });

        const audioBuffer = await downloadStreamWithProgress(
          audioUrl,
          settings.corsProxyUrl,
          (prog) => {
            const scaledPercent = 50 + Math.round(prog.percentage * 0.3);
            onProgress({
              stage: 'downloading_audio',
              percentage: scaledPercent,
              downloadedBytes: prog.downloadedBytes,
              totalBytes: prog.totalBytes,
              speed: prog.speed,
              speedFormatted: prog.speedFormatted,
              etaSeconds: prog.etaSeconds,
              statusMessage: `Ses akışı indiriliyor: %${prog.percentage} (${prog.speedFormatted})`,
            });
          },
          signal
        );

        // Stage 3: FFmpeg WebAssembly Lossless Muxing (80% - 95%)
        onProgress({
          stage: 'muxing',
          percentage: 82,
          downloadedBytes: videoBuffer.byteLength + audioBuffer.byteLength,
          totalBytes: videoBuffer.byteLength + audioBuffer.byteLength,
          speed: 0,
          speedFormatted: '',
          etaSeconds: 0,
          statusMessage: 'Görüntü ve ses FFmpeg WebAssembly ile birleştiriliyor (Kayıpsız)...',
        });

        const ffmpeg = this.ensureFFmpegWorker();

        const muxedBuffer = await this.sendWorkerMessage(
          ffmpeg,
          'mux',
          {
            videoBuffer,
            audioBuffer,
            videoExt: format.ext,
            audioExt: 'm4a',
            outputExt: 'mp4',
          },
          [videoBuffer, audioBuffer]
        );

        // Stage 4: Save to Disk
        onProgress({
          stage: 'saving',
          percentage: 98,
          downloadedBytes: muxedBuffer.byteLength,
          totalBytes: muxedBuffer.byteLength,
          speed: 0,
          speedFormatted: '',
          etaSeconds: 0,
          statusMessage: '1080p/4K video diske kaydediliyor...',
        });

        const filename = `${sanitizeFilename(videoInfo.title)} [${format.qualityLabel} 60fps].mp4`;
        await saveFileToDisk({
          filename,
          mimeType: 'video/mp4',
          data: muxedBuffer,
          useFileSystemAccess: settings.useFileSystemAccess,
        });
      }

      onProgress({
        stage: 'completed',
        percentage: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        speedFormatted: '',
        etaSeconds: 0,
        statusMessage: 'İndirme ve birleştirme başarıyla tamamlandı!',
      });

      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onProgress({
          stage: 'idle',
          percentage: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          speedFormatted: '',
          etaSeconds: 0,
          statusMessage: 'İndirme kullanıcı tarafından iptal edildi.',
        });
        return false;
      }

      onProgress({
        stage: 'error',
        percentage: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        speedFormatted: '',
        etaSeconds: 0,
        statusMessage: 'İndirme hatası',
        error: err?.message || 'Bilinmeyen bir hata oluştu.',
      });
      return false;
    }
  }

  // Download Audio Only (MP3 320kbps / M4A)
  public async downloadAudio(
    videoInfo: VideoInfo,
    audioFormat: VideoFormat,
    targetType: 'mp3' | 'm4a',
    settings: AppSettings,
    onProgress: (p: DownloadProgress) => void
  ): Promise<boolean> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      onProgress({
        stage: 'downloading_audio',
        percentage: 0,
        downloadedBytes: 0,
        totalBytes: audioFormat.filesize || 0,
        speed: 0,
        speedFormatted: '0 MB/s',
        etaSeconds: 0,
        statusMessage: 'Yüksek kaliteli ses akışı indiriliyor...',
      });

      const audioBuffer = await downloadStreamWithProgress(
        audioFormat.url,
        settings.corsProxyUrl,
        (prog) => {
          const scaledPercent = Math.round(prog.percentage * 0.7);
          onProgress({
            stage: 'downloading_audio',
            percentage: scaledPercent,
            downloadedBytes: prog.downloadedBytes,
            totalBytes: prog.totalBytes,
            speed: prog.speed,
            speedFormatted: prog.speedFormatted,
            etaSeconds: prog.etaSeconds,
            statusMessage: `Ses indiriliyor: %${prog.percentage} (${prog.speedFormatted})`,
          });
        },
        signal
      );

      let finalBuffer: ArrayBuffer = audioBuffer;
      let finalExt = targetType;
      let mimeType = targetType === 'mp3' ? 'audio/mpeg' : 'audio/mp4';

      if (targetType === 'mp3') {
        onProgress({
          stage: 'converting_audio',
          percentage: 80,
          downloadedBytes: audioBuffer.byteLength,
          totalBytes: audioBuffer.byteLength,
          speed: 0,
          speedFormatted: '',
          etaSeconds: 0,
          statusMessage: `MP3 (${settings.audioBitrate}) formatına dönüştürülüyor...`,
        });

        const ffmpeg = this.ensureFFmpegWorker();

        finalBuffer = await this.sendWorkerMessage(
          ffmpeg,
          'convert_audio',
          {
            audioBuffer,
            inputExt: audioFormat.ext,
            targetFormat: 'mp3',
            bitrate: settings.audioBitrate || '320k',
          },
          [audioBuffer]
        );
      }

      onProgress({
        stage: 'saving',
        percentage: 98,
        downloadedBytes: finalBuffer.byteLength,
        totalBytes: finalBuffer.byteLength,
        speed: 0,
        speedFormatted: '',
        etaSeconds: 0,
        statusMessage: 'Ses dosyası diske kaydediliyor...',
      });

      const filename = `${sanitizeFilename(videoInfo.title)} [${targetType.toUpperCase()}].${finalExt}`;
      await saveFileToDisk({
        filename,
        mimeType,
        data: finalBuffer,
        useFileSystemAccess: settings.useFileSystemAccess,
      });

      onProgress({
        stage: 'completed',
        percentage: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        speedFormatted: '',
        etaSeconds: 0,
        statusMessage: 'Ses dosyası başarıyla indirildi!',
      });

      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
      onProgress({
        stage: 'error',
        percentage: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        speedFormatted: '',
        etaSeconds: 0,
        statusMessage: 'Ses indirme hatası',
        error: err?.message || 'Bilinmeyen bir hata oluştu.',
      });
      return false;
    }
  }

  // Download Subtitles (.vtt / .srt)
  public async downloadSubtitle(
    videoInfo: VideoInfo,
    subtitle: SubtitleTrack,
    settings: AppSettings
  ): Promise<boolean> {
    try {
      let subUrl = subtitle.url;
      let response: Response;
      try {
        response = await fetch(subUrl);
      } catch {
        const proxy = settings.corsProxyUrl || 'https://corsproxy.io/?url=';
        response = await fetch(`${proxy}${encodeURIComponent(subUrl)}`);
      }

      if (!response.ok) throw new Error('Altyazı dosyası indirilemedi.');
      const subText = await response.text();

      const filename = `${sanitizeFilename(videoInfo.title)} [${subtitle.languageCode}].${subtitle.ext}`;
      await saveFileToDisk({
        filename,
        mimeType: 'text/vtt',
        data: new Blob([subText], { type: 'text/vtt;charset=utf-8' }),
        useFileSystemAccess: settings.useFileSystemAccess,
      });
      return true;
    } catch (err: any) {
      alert(`Altyazı indirilemedi: ${err?.message || err}`);
      return false;
    }
  }

  // Cancel active download
  public cancelDownload() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export const engine = new NimTubeEngine();

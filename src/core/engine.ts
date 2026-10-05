import type { 
  VideoInfo, 
  VideoFormat, 
  SubtitleTrack, 
  DownloadProgress, 
  AppSettings 
} from './types';
import { downloadStreamWithProgress, formatSpeed, type DownloadProgressUpdate } from './network/streamDownloader';
import { createStreamSource } from './network/streamSource';
import { saveFileToDisk, sanitizeFilename, triggerBrowserDownload } from './storage/fileSaver';
import {
  type ByteSink,
  createTempSink,
  createUserFileSink,
  pickSaveFile,
  removeUserFile,
  cleanupStaleTempFiles,
  getAvailableStorage,
  isDiskStorageSupported,
} from './storage/byteSink';
import { isExtensionAvailable, resolveVideoViaExtension } from './extension/extensionBridge';
import { parseInnertubeOutput } from './extractor/innertubeParser';

const GB = 1024 * 1024 * 1024;
/** Above this size, in-memory fallback would crash the tab. */
const MEMORY_FALLBACK_LIMIT = 1.5 * GB;
/** Keep a delivered temp output around long enough for the browser to copy it. */
const OUTPUT_TEMP_LIFETIME_MS = 30 * 60 * 1000;

function formatGb(bytes: number): string {
  return (bytes / GB).toFixed(1).replace('.', ',');
}

function idleProgress(statusMessage = ''): DownloadProgress {
  return {
    stage: 'idle',
    percentage: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    speedFormatted: '',
    etaSeconds: 0,
    statusMessage,
  };
}

/** Rough size estimate (bytes) when YouTube does not report one (e.g. livestreams). */
function estimateSize(format: VideoFormat | undefined, durationSeconds: number, fallbackKbps: number): number {
  if (!format) return 0;
  if (format.filesize && format.filesize > 0) return format.filesize;
  const bps = format.bitrate && format.bitrate > 0 ? format.bitrate : fallbackKbps * 1000;
  return durationSeconds > 0 ? Math.round((bps / 8) * durationSeconds) : 0;
}

/** Tracks every sink of one download so they can all be cleaned up on failure. */
class DownloadSession {
  private temps: ByteSink[] = [];
  private outputs: ByteSink[] = [];
  userHandle: FileSystemFileHandle | null = null;

  async temp(label: string, mime?: string) {
    const sink = await createTempSink(label, mime);
    this.temps.push(sink);
    return sink;
  }

  async output(mime: string) {
    const sink = this.userHandle ? await createUserFileSink(this.userHandle) : await createTempSink('output', mime);
    this.outputs.push(sink);
    return sink;
  }

  get lastOutput(): ByteSink | undefined {
    return this.outputs[this.outputs.length - 1];
  }

  async disposeTemps() {
    await Promise.all(this.temps.map((s) => s.dispose().catch(() => {})));
    this.temps = [];
  }

  /** Hands the finished file to the user. */
  async deliver(file: Blob, filename: string) {
    const out = this.lastOutput;
    if (out?.isUserFile) return; // Already written straight into the user's chosen file.
    triggerBrowserDownload(file, filename);
    if (out?.diskBacked) {
      setTimeout(() => out.dispose().catch(() => {}), OUTPUT_TEMP_LIFETIME_MS);
    }
  }

  async fail() {
    const all = [...this.temps, ...this.outputs];
    await Promise.all(all.map(async (s) => {
      await s.abort().catch(() => {});
      await s.dispose().catch(() => {});
    }));
    this.temps = [];
    this.outputs = [];
    await removeUserFile(this.userHandle);
  }
}

class NimTubeEngine {
  private innertubeWorker: Worker | null = null;
  private abortController: AbortController | null = null;
  private messageCallbacks = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor() {
    this.initWorkers();
    // Remove leftovers from interrupted downloads in earlier sessions.
    cleanupStaleTempFiles().catch(() => {});
  }

  public initWorkers() {
    // Initialize InnerTube Worker (Client-side YouTube API resolver fallback)
    if (!this.innertubeWorker) {
      try {
        this.innertubeWorker = new Worker(
          new URL('./extractor/innertubeWorker.ts', import.meta.url),
          { type: 'module' }
        );

        this.innertubeWorker.onmessage = (e) => {
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
      } catch (err) {
        console.warn('InnerTube worker init error:', err);
      }
    }
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
    if (!this.innertubeWorker) {
      this.initWorkers();
    }
    
    return await this.sendWorkerMessage(this.innertubeWorker!, 'extract', {
      url,
      proxyUrl: settings.corsProxyUrl,
    });
  }

  /**
   * Makes sure the device can hold the temporary files. `tempBytes` is what goes
   * into browser storage (OPFS); files saved via the picker don't count.
   */
  private async checkStorage(tempBytes: number) {
    if (tempBytes <= 0) return;
    const diskOk = await isDiskStorageSupported();
    if (!diskOk) {
      if (tempBytes > MEMORY_FALLBACK_LIMIT) {
        throw new Error(
          'Bu video tarayıcınızda indirilemeyecek kadar büyük. Lütfen güncel Chrome veya Edge ile tekrar deneyin.'
        );
      }
      return;
    }
    // Leftovers from closed/crashed tabs count against the browser's quota.
    await cleanupStaleTempFiles();
    const available = await getAvailableStorage();
    const needed = Math.round(tempBytes * 1.1);
    if (Number.isFinite(available) && available < needed) {
      console.warn(`[Engine] Tarayıcı depolama kotası yetersiz: ${available} bayt boş, ${needed} bayt gerekiyor.`);
      throw new Error(
        `Tarayıcınız bu siteye ${formatGb(available)} GB geçici alan ayırıyor, bu video için yaklaşık ${formatGb(needed)} GB gerekiyor. ` +
          'Gizli sekmedeyseniz normal sekmede deneyin ya da diskte biraz daha yer açın.'
      );
    }
  }

  private scaleProgress(
    onProgress: (p: DownloadProgress) => void,
    stage: DownloadProgress['stage'],
    from: number,
    span: number,
    label: string
  ) {
    return (prog: DownloadProgressUpdate) => {
      onProgress({
        stage,
        percentage: from + Math.round(prog.percentage * span),
        downloadedBytes: prog.downloadedBytes,
        totalBytes: prog.totalBytes,
        speed: prog.speed,
        speedFormatted: prog.speedFormatted,
        etaSeconds: prog.etaSeconds,
        statusMessage: `${label}: %${prog.percentage} (${prog.speedFormatted})`,
      });
    };
  }

  private reportError(err: any, onProgress: (p: DownloadProgress) => void) {
    onProgress({
      ...idleProgress('İndirme tamamlanamadı'),
      stage: 'error',
      error: err?.message || 'Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.',
    });
  }

  // Download Video (Progressive or Adaptive 1080p/4K with Mediabunny Lossless Muxing)
  public async downloadVideo(
    videoInfo: VideoInfo,
    format: VideoFormat,
    settings: AppSettings,
    onProgress: (p: DownloadProgress) => void
  ): Promise<boolean> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const session = new DownloadSession();

    const outExt: 'mp4' | 'webm' = settings.macCompatibilityMode
      ? 'mp4'
      : (format.ext === 'webm' ? 'webm' : 'mp4');
    const outMime = outExt === 'webm' ? 'video/webm' : 'video/mp4';
    const fpsTag = format.fps && format.fps >= 50 ? ` ${format.fps}fps` : '';
    const baseName = sanitizeFilename(`${videoInfo.title} [${format.qualityLabel}${fpsTag}]`);

    // 1. Ask where to save FIRST — the picker needs the click's user activation, and
    //    writing straight into the chosen file avoids an extra multi-GB copy at the end.
    try {
      session.userHandle = await pickSaveFile(`${baseName}.${outExt}`, outMime, settings.useFileSystemAccess);
    } catch {
      onProgress(idleProgress());
      return false;
    }

    try {
      const duration = videoInfo.duration || 0;
      const videoBytes = estimateSize(format, duration, 5000);

      if (!format.isAdaptive) {
        // --- 1. SINGLE STREAM DIRECT DOWNLOAD (e.g. 720p / 360p) ---
        await this.checkStorage(session.userHandle ? 0 : videoBytes);

        onProgress({
          ...idleProgress(`${format.qualityLabel} video indiriliyor...`),
          stage: 'downloading_video',
          totalBytes: format.filesize || 0,
          speedFormatted: '0 MB/s',
        });

        const outputSink = await session.output(outMime);
        const file = await downloadStreamWithProgress({
          url: format.url,
          proxyUrl: settings.corsProxyUrl,
          sink: outputSink,
          onProgress: this.scaleProgress(onProgress, 'downloading_video', 0, 0.98, `${format.qualityLabel} indiriliyor`),
          signal,
          expectedDurationSeconds: duration,
          knownFilesize: format.filesize,
        });

        onProgress({ ...idleProgress('Dosya kaydediliyor...'), stage: 'saving', percentage: 99 });
        await session.deliver(file, `${baseName}.${format.ext || 'mp4'}`);
      } else {
        // --- 2. ADAPTIVE DASH STREAMS (1080p, 1440p, 4K -> Video + Audio Muxing) ---
        let audioFormat: VideoFormat | undefined;
        if (outExt === 'mp4') {
          audioFormat = videoInfo.audioFormats.find(
            f => f.ext === 'm4a' || f.audioCodec?.includes('mp4a') || (f as any).mimeType?.includes('mp4') || f.formatId === '140'
          );
        } else {
          audioFormat = videoInfo.audioFormats.find(
            f => f.ext === 'webm' || f.audioCodec?.includes('opus') || (f as any).mimeType?.includes('webm') || f.formatId === '251'
          );
        }
        if (!audioFormat?.url) {
          audioFormat = videoInfo.audioFormats[0] || videoInfo.formats.find(f => f.hasAudio && !f.hasVideo);
        }
        const audioUrl = audioFormat?.url || format.audioUrl;
        if (!audioUrl) {
          throw new Error('Bu video için ses bulunamadı.');
        }

        const audioBytes = estimateSize(audioFormat, duration, 160);
        const totalExpectedBytes = videoBytes + audioBytes;

        const isLive =
          format.url.includes('noclen=1') ||
          format.url.includes('source=yt_live_broadcast') ||
          format.url.includes('live=1');

        if (!isLive) {
          // --- ZERO-TEMP STREAMING REMUX (Streams video + audio on the fly directly into output) ---
          // When session.userHandle exists (e.g. user selected D: drive), tempBytes on C: is 0!
          // When session.userHandle is null, only the single final output file is stored in OPFS.
          const tempBytes = session.userHandle ? 0 : totalExpectedBytes;
          await this.checkStorage(tempBytes);

          let downloadedBytes = 0;
          let lastTime = Date.now();
          let lastBytes = 0;
          let currentSpeed = 0;

          const reportMuxProgress = (force = false) => {
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000;
            if (!force && timeDiff < 0.25) return;
            const instant = (downloadedBytes - lastBytes) / (timeDiff || 1);
            currentSpeed = currentSpeed > 0 ? currentSpeed * 0.7 + instant * 0.3 : instant;
            lastTime = now;
            lastBytes = downloadedBytes;

            const pct = Math.min(99, Math.round((downloadedBytes / (totalExpectedBytes || 1)) * 100));
            const remainingBytes = Math.max(0, totalExpectedBytes - downloadedBytes);
            const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

            onProgress({
              stage: 'downloading_video',
              percentage: pct,
              downloadedBytes,
              totalBytes: totalExpectedBytes,
              speed: currentSpeed,
              speedFormatted: formatSpeed(currentSpeed),
              etaSeconds,
              statusMessage: `${format.qualityLabel} indiriliyor: %${pct} (${formatSpeed(currentSpeed)})`,
            });
          };

          onProgress({
            ...idleProgress(`${format.qualityLabel} video ve ses hazırlanıyor...`),
            stage: 'downloading_video',
            totalBytes: totalExpectedBytes,
            speedFormatted: '0 MB/s',
          });

          const videoSource = createStreamSource({
            url: format.url,
            totalBytes: videoBytes,
            proxyUrl: settings.corsProxyUrl,
            signal,
            onBytes: (n) => {
              downloadedBytes += n;
              reportMuxProgress();
            },
          });

          const audioSource = createStreamSource({
            url: audioUrl,
            totalBytes: audioBytes,
            proxyUrl: settings.corsProxyUrl,
            signal,
            onBytes: (n) => {
              downloadedBytes += n;
              reportMuxProgress();
            },
          });

          const { losslessMux } = await import('./muxer/streamMuxer');
          let muxResult;
          try {
            muxResult = await losslessMux({
              videoSource,
              audioSource,
              outputExt: outExt,
              macCompatibilityMode: settings.macCompatibilityMode,
              createOutputSink: () => session.output(outMime),
              durationSeconds: duration,
              signal,
              onProgress: (_pct, msg) => {
                if (settings.macCompatibilityMode && msg) {
                  onProgress({
                    ...idleProgress(msg),
                    stage: 'muxing',
                    percentage: Math.min(99, Math.round((downloadedBytes / (totalExpectedBytes || 1)) * 100)),
                    downloadedBytes,
                    totalBytes: totalExpectedBytes,
                    speed: currentSpeed,
                    speedFormatted: formatSpeed(currentSpeed),
                    etaSeconds: currentSpeed > 0 ? Math.round((totalExpectedBytes - downloadedBytes) / currentSpeed) : 0,
                  });
                }
              },
            });
          } catch (muxErr: any) {
            if (muxErr?.name === 'AbortError') throw muxErr;
            console.error('[NimTube Engine] StreamMuxer birleştirme hatası:', muxErr);
            throw new Error('Video işlenirken bir sorun oluştu. Lütfen tekrar deneyin.');
          }

          onProgress({ ...idleProgress('Dosya kaydediliyor...'), stage: 'saving', percentage: 99 });
          await session.deliver(muxResult.blob, `${baseName}.${muxResult.ext}`);
        } else {
          // --- LIVE SEGMENTED STREAM FALLBACK ---
          const tempBytes = videoBytes + audioBytes + (session.userHandle ? 0 : videoBytes + audioBytes);
          await this.checkStorage(tempBytes);

          // Stage 1: Download Video Track (0 - 50%)
          onProgress({
            ...idleProgress(`${format.qualityLabel} video indiriliyor...`),
            stage: 'downloading_video',
            totalBytes: format.filesize || 0,
            speedFormatted: '0 MB/s',
          });

          const videoBlob = await downloadStreamWithProgress({
            url: format.url,
            proxyUrl: settings.corsProxyUrl,
            sink: await session.temp('video'),
            onProgress: this.scaleProgress(onProgress, 'downloading_video', 0, 0.5, 'Görüntü indiriliyor'),
            signal,
            expectedDurationSeconds: duration,
            knownFilesize: format.filesize,
          });

          // Stage 2: Download Audio Track (50% - 70%)
          onProgress({
            ...idleProgress('Ses indiriliyor...'),
            stage: 'downloading_audio',
            percentage: 50,
            speedFormatted: '0 MB/s',
          });

          const audioBlob = await downloadStreamWithProgress({
            url: audioUrl,
            proxyUrl: settings.corsProxyUrl,
            sink: await session.temp('audio'),
            onProgress: this.scaleProgress(onProgress, 'downloading_audio', 50, 0.2, 'Ses indiriliyor'),
            signal,
            expectedDurationSeconds: duration,
            knownFilesize: audioFormat?.filesize,
          });

          // Stage 3: Lossless muxing streamed to disk (70% - 98%)
          const totalRawBytes = videoBlob.size + audioBlob.size;
          onProgress({
            ...idleProgress('Görüntü ve ses birleştiriliyor...'),
            stage: 'muxing',
            percentage: 70,
            downloadedBytes: totalRawBytes,
            totalBytes: totalRawBytes,
          });

          const { losslessMux } = await import('./muxer/streamMuxer');
          let muxResult;
          try {
            muxResult = await losslessMux({
              videoBlob,
              audioBlob,
              outputExt: outExt,
              macCompatibilityMode: settings.macCompatibilityMode,
              createOutputSink: () => session.output(outMime),
              durationSeconds: duration,
              signal,
              onProgress: (pct, msg) => {
                onProgress({
                  ...idleProgress(msg),
                  stage: 'muxing',
                  percentage: 70 + Math.round(pct * 0.28),
                  downloadedBytes: totalRawBytes,
                  totalBytes: totalRawBytes,
                });
              },
            });
          } catch (muxErr: any) {
            if (muxErr?.name === 'AbortError') throw muxErr;
            console.error('[NimTube Engine] StreamMuxer birleştirme hatası:', muxErr);
            throw new Error('Video işlenirken bir sorun oluştu. Lütfen tekrar deneyin.');
          }

          // Source tracks are no longer needed — free the disk space right away.
          await session.disposeTemps();

          onProgress({ ...idleProgress('Dosya kaydediliyor...'), stage: 'saving', percentage: 99 });
          await session.deliver(muxResult.blob, `${baseName}.${muxResult.ext}`);
        }
      }

      onProgress({ ...idleProgress('İndirme tamamlandı!'), stage: 'completed', percentage: 100 });
      return true;
    } catch (err: any) {
      console.error('[NimTube Engine] downloadVideo hatası:', err);
      await session.fail();
      if (err?.name === 'AbortError' || signal.aborted) {
        onProgress(idleProgress('İndirme iptal edildi.'));
        return false;
      }
      this.reportError(err, onProgress);
      return false;
    }
  }

  // Download Audio Only (original M4A / WebM stream, no re-encoding)
  public async downloadAudio(
    videoInfo: VideoInfo,
    audioFormat: VideoFormat,
    targetType: 'mp3' | 'm4a',
    settings: AppSettings,
    onProgress: (p: DownloadProgress) => void
  ): Promise<boolean> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const session = new DownloadSession();

    const isWebm = audioFormat.ext === 'webm' || audioFormat.audioCodec?.includes('opus');
    const finalExt = isWebm ? 'webm' : 'm4a';
    const mimeType = isWebm ? 'audio/webm' : 'audio/mp4';
    const label = targetType === 'mp3' ? 'AUDIO' : targetType.toUpperCase();
    const filename = sanitizeFilename(`${videoInfo.title} [${label}].${finalExt}`);

    try {
      session.userHandle = await pickSaveFile(filename, mimeType, settings.useFileSystemAccess);
    } catch {
      onProgress(idleProgress());
      return false;
    }

    try {
      const audioBytes = estimateSize(audioFormat, videoInfo.duration || 0, 160);
      await this.checkStorage(session.userHandle ? 0 : audioBytes);

      onProgress({
        ...idleProgress('Ses indiriliyor...'),
        stage: 'downloading_audio',
        totalBytes: audioFormat.filesize || 0,
        speedFormatted: '0 MB/s',
      });

      const file = await downloadStreamWithProgress({
        url: audioFormat.url,
        proxyUrl: settings.corsProxyUrl,
        sink: await session.output(mimeType),
        onProgress: this.scaleProgress(onProgress, 'downloading_audio', 0, 0.98, 'Ses indiriliyor'),
        signal,
        expectedDurationSeconds: videoInfo.duration,
        knownFilesize: audioFormat.filesize,
      });

      onProgress({ ...idleProgress('Ses dosyası kaydediliyor...'), stage: 'saving', percentage: 99 });
      await session.deliver(file, filename);

      onProgress({ ...idleProgress('İndirme tamamlandı!'), stage: 'completed', percentage: 100 });
      return true;
    } catch (err: any) {
      console.error('[NimTube Engine] downloadAudio hatası:', err);
      await session.fail();
      if (err?.name === 'AbortError' || signal.aborted) {
        onProgress(idleProgress('İndirme iptal edildi.'));
        return false;
      }
      this.reportError(err, onProgress);
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
      console.error('[NimTube Engine] Altyazı indirilemedi:', err);
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

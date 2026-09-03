import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;
let isInitializing = false;

const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

async function initFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && isLoaded) return ffmpeg;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (ffmpeg && isLoaded) return ffmpeg;
  }

  isInitializing = true;
  self.postMessage({ type: 'status', message: 'WebAssembly FFmpeg motoru yükleniyor...' });

  try {
    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      self.postMessage({ type: 'ffmpeg_log', message });
    });

    ffmpeg.on('progress', ({ progress, time }) => {
      self.postMessage({ 
        type: 'mux_progress', 
        percentage: Math.min(100, Math.round(progress * 100)),
        time 
      });
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    isLoaded = true;
    isInitializing = false;
    self.postMessage({ type: 'status', message: 'FFmpeg Wasm motoru hazır!' });
    return ffmpeg;
  } catch (err: any) {
    isInitializing = false;
    throw new Error(`FFmpeg yüklenemedi: ${err?.message || err}`);
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { action, id, payload } = e.data;

  if (action === 'init') {
    try {
      await initFFmpeg();
      self.postMessage({ id, type: 'init_done', success: true });
    } catch (err: any) {
      self.postMessage({ id, type: 'init_done', success: false, error: err.message });
    }
    return;
  }

  if (action === 'mux') {
    const { videoBuffer, audioBuffer, videoExt, audioExt, outputExt } = payload;

    try {
      const ff = await initFFmpeg();
      self.postMessage({ type: 'status', message: 'Video ve ses parçaları FFmpeg belleğine yazılıyor...' });

      const inVideoName = `input_video.${videoExt || 'mp4'}`;
      const inAudioName = `input_audio.${audioExt || 'm4a'}`;
      const outName = `output.${outputExt || 'mp4'}`;

      await ff.writeFile(inVideoName, new Uint8Array(videoBuffer));
      await ff.writeFile(inAudioName, new Uint8Array(audioBuffer));

      self.postMessage({ type: 'status', message: 'Görüntü ve ses WebAssembly ile birleştiriliyor (Muxing)...' });

      // Run FFmpeg command: -c copy for fast lossless multiplexing
      const args = [
        '-i', inVideoName,
        '-i', inAudioName,
        '-c', 'copy',
        '-movflags', '+faststart',
        outName
      ];

      await ff.exec(args);

      self.postMessage({ type: 'status', message: 'Birleştirilen dosya okunuyor...' });
      const resultData = await ff.readFile(outName);

      // Clean up temporary files in Wasm FS
      try {
        await ff.deleteFile(inVideoName);
        await ff.deleteFile(inAudioName);
        await ff.deleteFile(outName);
      } catch (cleanErr) {
        console.warn('FFmpeg cleanup warning:', cleanErr);
      }

      // Convert resultData to ArrayBuffer and transfer ownership back
      const buffer = (resultData as Uint8Array).buffer;
      self.postMessage(
        { id, type: 'mux_success', buffer },
        [buffer]
      );
    } catch (err: any) {
      self.postMessage({ 
        id, 
        type: 'mux_error', 
        error: err?.message || 'FFmpeg birleştirme hatası.' 
      });
    }
  }

  if (action === 'convert_audio') {
    const { audioBuffer, inputExt, targetFormat, bitrate } = payload;

    try {
      const ff = await initFFmpeg();
      self.postMessage({ type: 'status', message: 'Ses dosyası dönüştürülüyor...' });

      const inAudioName = `input_audio.${inputExt || 'm4a'}`;
      const outAudioName = `output.${targetFormat || 'mp3'}`;

      await ff.writeFile(inAudioName, new Uint8Array(audioBuffer));

      let args: string[];
      if (targetFormat === 'mp3') {
        args = [
          '-i', inAudioName,
          '-vn',
          '-b:a', bitrate || '320k',
          '-ar', '44100',
          outAudioName
        ];
      } else {
        args = [
          '-i', inAudioName,
          '-vn',
          '-c:a', 'copy',
          outAudioName
        ];
      }

      await ff.exec(args);

      const resultData = await ff.readFile(outAudioName);

      try {
        await ff.deleteFile(inAudioName);
        await ff.deleteFile(outAudioName);
      } catch (cleanErr) {
        console.warn('FFmpeg cleanup warning:', cleanErr);
      }

      const buffer = (resultData as Uint8Array).buffer;
      self.postMessage(
        { id, type: 'convert_success', buffer },
        [buffer]
      );
    } catch (err: any) {
      self.postMessage({ 
        id, 
        type: 'convert_error', 
        error: err?.message || 'Ses dönüştürme hatası.' 
      });
    }
  }
};

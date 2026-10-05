import {
  Input,
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  StreamTarget,
  BlobSource,
  ALL_FORMATS,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Conversion,
  type Target,
  Source,
} from 'mediabunny';
import { sinkToWritableStream, type ByteSink } from '../storage/byteSink';

export interface MuxProgressCallback {
  (percentage: number, statusText: string): void;
}

export interface MuxOptions {
  videoBlob?: Blob;
  audioBlob?: Blob;
  videoSource?: Source;
  audioSource?: Source;
  /** Preferred container. WebM is only used if both codecs are WebM-compatible. */
  outputExt?: 'mp4' | 'webm';
  macCompatibilityMode?: boolean;
  /**
   * Creates the disk-backed output. When provided, the muxed file is streamed to
   * it and never held in memory. May be called again if a transcode attempt fails.
   * When omitted (or it returns null), an in-memory buffer is used.
   */
  createOutputSink?: () => Promise<ByteSink | null>;
  /** Expected media duration in seconds (for progress reporting). */
  durationSeconds?: number;
  signal?: AbortSignal;
  onProgress?: MuxProgressCallback;
}

export interface MuxResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
  mimeType: 'video/mp4' | 'video/webm';
  wasTranscoded: boolean;
}

const WEBM_VIDEO_CODECS = new Set(['vp8', 'vp9', 'av1']);
const WEBM_AUDIO_CODECS = new Set(['opus', 'vorbis']);

function abortError(): Error {
  const err = new Error('İndirme iptal edildi.');
  err.name = 'AbortError';
  return err;
}

/** Decides the container before muxing so the file name can be chosen up front. */
export function resolveContainer(
  preferred: 'mp4' | 'webm',
  macCompatibilityMode: boolean,
  videoCodec?: string | null,
  audioCodec?: string | null
): 'mp4' | 'webm' {
  if (macCompatibilityMode || preferred !== 'webm') return 'mp4';
  if (videoCodec && !WEBM_VIDEO_CODECS.has(videoCodec)) return 'mp4';
  if (audioCodec && !WEBM_AUDIO_CODECS.has(audioCodec)) return 'mp4';
  return 'webm';
}

function createTarget(outputSink: ByteSink | null | undefined): { target: Target; buffer?: BufferTarget } {
  if (outputSink && outputSink.diskBacked) {
    return {
      target: new StreamTarget(sinkToWritableStream(outputSink) as any, { chunked: true, chunkSize: 8 * 1024 * 1024 }),
    };
  }
  const buffer = new BufferTarget();
  return { target: buffer, buffer };
}

async function collectResult(
  outputSink: ByteSink | null | undefined,
  buffer: BufferTarget | undefined,
  mimeType: string
): Promise<Blob> {
  if (buffer) {
    if (!buffer.buffer) throw new Error('Dosya oluşturulamadı. Lütfen tekrar deneyin.');
    const blob = new Blob([buffer.buffer], { type: mimeType });
    // If a (memory) sink was given, keep behaviour consistent by writing into it.
    if (outputSink) {
      await outputSink.write(0, new Uint8Array(buffer.buffer));
      return await outputSink.finish();
    }
    return blob;
  }
  return await outputSink!.finish();
}

export async function losslessMux({
  videoBlob,
  audioBlob,
  videoSource,
  audioSource,
  outputExt = 'mp4',
  macCompatibilityMode = false,
  createOutputSink,
  durationSeconds,
  signal,
  onProgress,
}: MuxOptions): Promise<MuxResult> {
  onProgress?.(5, 'Video ve ses hazırlanıyor...');

  const vSrc = videoSource ?? (videoBlob ? new BlobSource(videoBlob) : null);
  const aSrc = audioSource ?? (audioBlob ? new BlobSource(audioBlob) : null);

  if (!vSrc) throw new Error('Video verisi alınamadı.');
  if (!aSrc) throw new Error('Ses verisi alınamadı.');

  // Sources read lazily — with CustomSource/Files nothing is pre-loaded into RAM.
  const videoInput = new Input({ source: vSrc, formats: ALL_FORMATS });
  const audioInput = new Input({ source: aSrc, formats: ALL_FORMATS });

  const videoTrack = await videoInput.getPrimaryVideoTrack();
  const audioTrack = await audioInput.getPrimaryAudioTrack();

  if (!videoTrack) throw new Error('Video akışı okunamadı.');
  if (!audioTrack) throw new Error('Ses akışı okunamadı.');
  if (!videoTrack.codec) throw new Error('Video formatı desteklenmiyor.');
  if (!audioTrack.codec) throw new Error('Ses formatı desteklenmiyor.');

  let outputSink: ByteSink | null = (await createOutputSink?.()) ?? null;

  console.log(
    `%c[StreamMuxer]%c Video codec: ${videoTrack.codec} (${videoTrack.displayWidth}x${videoTrack.displayHeight}), Audio codec: ${audioTrack.codec} | Mac Mode: ${macCompatibilityMode} | Disk: ${Boolean(outputSink?.diskBacked)}`,
    'color: #38bdf8; font-weight: bold;',
    'color: inherit;'
  );

  // --- MAC COMPATIBILITY MODE TRANSCODING (WebCodecs GPU Hardware Accelerated) ---
  if (macCompatibilityMode && videoTrack.codec !== 'avc') {
    try {
      onProgress?.(15, 'Mac uyumluluğu için video hazırlanıyor...');

      const { target, buffer } = createTarget(outputSink);
      const output = new Output({
        format: new Mp4OutputFormat({ fastStart: buffer ? 'in-memory' : false }),
        target,
      });

      const videoConversion = await Conversion.init({
        input: videoInput,
        output,
        composable: true,
        video: { codec: 'avc', hardwareAcceleration: 'prefer-hardware' },
        audio: { discard: true },
      });

      const audioConversion = await Conversion.init({
        input: audioInput,
        output,
        composable: true,
        video: { discard: true },
        audio: { codec: 'aac' },
      });

      if (!videoConversion.isValid || !audioConversion.isValid) {
        console.warn('[StreamMuxer] Conversion validity warning:', {
          videoValid: videoConversion.isValid,
          videoDiscarded: videoConversion.discardedTracks,
          audioValid: audioConversion.isValid,
          audioDiscarded: audioConversion.discardedTracks,
        });
        throw new Error('Tarayıcınız bu çözünürlükte video dönüştürmeyi desteklemiyor.');
      }

      let lastReport = 0;
      videoConversion.onProgress = (prog) => {
        const now = Date.now();
        if (now - lastReport < 250) return;
        lastReport = now;
        const pct = Math.min(95, 20 + Math.round(prog * 75));
        onProgress?.(pct, `Mac için dönüştürülüyor: %${Math.round(prog * 100)}`);
      };

      const onAbort = () => {
        videoConversion.cancel().catch(() => {});
        audioConversion.cancel().catch(() => {});
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      try {
        await output.start();
        await Promise.all([videoConversion.execute(), audioConversion.execute()]);
        await output.finalize();
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
      if (signal?.aborted) throw abortError();

      const finalBlob = await collectResult(outputSink, buffer, 'video/mp4');
      console.log(
        `%c[StreamMuxer]%c Mac H.264 MP4 dönüştürüldü. Boyut: ${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB`,
        'color: #10b981; font-weight: bold;',
        'color: inherit;'
      );

      onProgress?.(100, 'Tamamlandı!');
      return { blob: finalBlob, ext: 'mp4', mimeType: 'video/mp4', wasTranscoded: true };
    } catch (transcodeErr: any) {
      if (transcodeErr?.name === 'AbortError' || signal?.aborted) throw abortError();
      if (outputSink) {
        // Partially written output can't be reused — start over with a fresh sink.
        await outputSink.abort();
        outputSink = (await createOutputSink?.()) ?? null;
      }
      console.warn('[StreamMuxer] WebCodecs dönüştürme hatası, kayıpsız birleştirme deneniyor:', transcodeErr);
      onProgress?.(25, 'Orijinal formatta hazırlanıyor...');
    }
  }

  // --- FAST LOSSLESS PASSTHROUGH REMUXING (zero quality loss, constant memory) ---
  onProgress?.(10, 'Video ve ses birleştiriliyor...');
  const vDec = await videoTrack.getDecoderConfig();
  const aDec = await audioTrack.getDecoderConfig();

  const container = resolveContainer(outputExt, macCompatibilityMode, videoTrack.codec, audioTrack.codec);
  const isWebM = container === 'webm';
  const { target, buffer } = createTarget(outputSink);

  // Disk output: metadata at the end (fastStart: false) keeps memory flat even for
  // hundreds of thousands of frames. Memory output keeps the classic fast-start layout.
  const format = isWebM
    ? new WebMOutputFormat()
    : new Mp4OutputFormat({ fastStart: buffer ? 'in-memory' : false });

  const output = new Output({ format, target });
  const outVideoSource = new EncodedVideoPacketSource(videoTrack.codec as any);
  const outAudioSource = new EncodedAudioPacketSource(audioTrack.codec as any);
  output.addVideoTrack(outVideoSource);
  output.addAudioTrack(outAudioSource);
  await output.start();

  const videoIter = new EncodedPacketSink(videoTrack).packets()[Symbol.asyncIterator]();
  const audioIter = new EncodedPacketSink(audioTrack).packets()[Symbol.asyncIterator]();

  let v = await videoIter.next();
  let a = await audioIter.next();
  let vFirst = true;
  let aFirst = true;
  let vCount = 0;
  let aCount = 0;
  let startTs: number | null = null;
  let lastReport = 0;

  // Interleave packets by timestamp. Adding all video first and then all audio forces
  // the muxer to buffer the entire video in memory — fatal for multi-hour streams.
  while (!v.done || !a.done) {
    if (signal?.aborted) {
      await output.cancel().catch(() => {});
      throw abortError();
    }

    const takeVideo = a.done || (!v.done && v.value.timestamp <= a.value.timestamp);
    if (takeVideo && !v.done) {
      const packet = v.value;
      if (startTs === null) startTs = packet.timestamp;
      await outVideoSource.add(packet, vFirst ? { decoderConfig: vDec || undefined } : undefined);
      vFirst = false;
      vCount++;
      v = await videoIter.next();

      const now = Date.now();
      if (now - lastReport >= 250) {
        lastReport = now;
        const elapsed = packet.timestamp - (startTs ?? 0);
        const ratio = durationSeconds && durationSeconds > 0 ? Math.min(1, elapsed / durationSeconds) : 0;
        onProgress?.(10 + Math.round(ratio * 85), `Video ve ses birleştiriliyor: %${Math.round(ratio * 100)}`);
      }
    } else if (!a.done) {
      await outAudioSource.add(a.value, aFirst ? { decoderConfig: aDec || undefined } : undefined);
      aFirst = false;
      aCount++;
      a = await audioIter.next();
    }
  }

  onProgress?.(96, 'Dosya tamamlanıyor...');
  await output.finalize();

  const finalExt: 'mp4' | 'webm' = isWebM ? 'webm' : 'mp4';
  const finalMime = isWebM ? 'video/webm' : 'video/mp4';
  const finalBlob = await collectResult(outputSink, buffer, finalMime);

  console.log(
    `%c[StreamMuxer]%c Tamamlandı: ${vCount} video karesi + ${aCount} ses karesi (${finalExt.toUpperCase()}). Boyut: ${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB`,
    'color: #10b981; font-weight: bold;',
    'color: inherit;'
  );

  onProgress?.(100, 'Tamamlandı!');
  return { blob: finalBlob, ext: finalExt, mimeType: finalMime, wasTranscoded: false };
}

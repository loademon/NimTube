import {
  Input,
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  BlobSource,
  BufferSource,
  ALL_FORMATS,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Conversion,
} from 'mediabunny';

export interface MuxProgressCallback {
  (percentage: number, statusText: string): void;
}

export interface MuxOptions {
  videoBlob?: Blob | ArrayBuffer;
  videoBuffer?: Blob | ArrayBuffer;
  audioBlob?: Blob | ArrayBuffer;
  audioBuffer?: Blob | ArrayBuffer;
  videoExt?: string;
  audioExt?: string;
  outputExt?: string;
  macCompatibilityMode?: boolean;
  onProgress?: MuxProgressCallback;
}

export interface MuxResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
  mimeType: 'video/mp4' | 'video/webm';
  wasTranscoded: boolean;
}

export async function losslessMux({
  videoBlob,
  videoBuffer,
  audioBlob,
  audioBuffer,
  outputExt = 'mp4',
  macCompatibilityMode = false,
  onProgress,
}: MuxOptions): Promise<MuxResult> {
  onProgress?.(5, 'Medya akışları ayrıştırılıyor (Demuxing)...');

  const rawVideo = videoBlob || videoBuffer;
  const rawAudio = audioBlob || audioBuffer;

  if (!rawVideo) {
    throw new Error('Video verisi bulunamadı.');
  }
  if (!rawAudio) {
    throw new Error('Ses verisi bulunamadı.');
  }

  const videoSourceInst = rawVideo instanceof Blob ? new BlobSource(rawVideo) : new BufferSource(rawVideo);
  const audioSourceInst = rawAudio instanceof Blob ? new BlobSource(rawAudio) : new BufferSource(rawAudio);

  const videoInput = new Input({
    source: videoSourceInst,
    formats: ALL_FORMATS,
  });

  const audioInput = new Input({
    source: audioSourceInst,
    formats: ALL_FORMATS,
  });

  const videoTrack = await videoInput.getPrimaryVideoTrack();
  const audioTrack = await audioInput.getPrimaryAudioTrack();

  if (!videoTrack) {
    throw new Error('Görüntü akışında geçerli bir video izi bulunamadı.');
  }
  if (!audioTrack) {
    throw new Error('Ses akışında geçerli bir ses izi bulunamadı.');
  }
  if (!videoTrack.codec) {
    throw new Error('Video kod çözücü bilgisi (codec) tespit edilemedi.');
  }
  if (!audioTrack.codec) {
    throw new Error('Ses kod çözücü bilgisi (codec) tespit edilemedi.');
  }

  console.log(
    `%c[StreamMuxer]%c Video codec: ${videoTrack.codec} (${videoTrack.displayWidth}x${videoTrack.displayHeight}), Audio codec: ${audioTrack.codec} | Mac Mode: ${macCompatibilityMode}`,
    'color: #38bdf8; font-weight: bold;',
    'color: inherit;'
  );

  // --- MAC COMPATIBILITY MODE TRANSCODING (WebCodecs GPU Hardware Accelerated) ---
  // If Mac mode is requested and the video is NOT already H.264 (AVC)
  if (macCompatibilityMode && videoTrack.codec !== 'avc') {
    try {
      onProgress?.(15, 'Mac / QuickTime için H.264 dönüştürücü hazırlanıyor (WebCodecs)...');

      const target = new BufferTarget();
      const output = new Output({
        format: new Mp4OutputFormat(),
        target,
      });

      const videoConversion = await Conversion.init({
        input: videoInput,
        output,
        composable: true,
        video: {
          codec: 'avc',
          hardwareAcceleration: 'prefer-hardware',
        },
        audio: {
          discard: true,
        },
      });

      const audioConversion = await Conversion.init({
        input: audioInput,
        output,
        composable: true,
        video: {
          discard: true,
        },
        audio: {
          codec: 'aac',
        },
      });

      if (!videoConversion.isValid || !audioConversion.isValid) {
        console.warn('[StreamMuxer] Conversion validity warning:', {
          videoValid: videoConversion.isValid,
          videoDiscarded: videoConversion.discardedTracks,
          audioValid: audioConversion.isValid,
          audioDiscarded: audioConversion.discardedTracks,
        });
        throw new Error('Tarayıcı bu çözünürlükte WebCodecs H.264 kodlamayı desteklemiyor.');
      }

      videoConversion.onProgress = (prog) => {
        const pct = Math.min(95, 20 + Math.round(prog * 75));
        onProgress?.(pct, `Mac için H.264 MP4 dönüştürülüyor (GPU): %${Math.round(prog * 100)}`);
      };

      await output.start();

      await Promise.all([
        videoConversion.execute(),
        audioConversion.execute(),
      ]);

      await output.finalize();

      if (!target.buffer) {
        throw new Error('Dönüştürme çıktısı oluşturulamadı.');
      }

      const finalBlob = new Blob([target.buffer], { type: 'video/mp4' });
      const finalMb = (finalBlob.size / (1024 * 1024)).toFixed(2);
      console.log(
        `%c[StreamMuxer]%c Mac H.264 MP4 başarıyla dönüştürüldü. Boyut: ${finalMb} MB`,
        'color: #10b981; font-weight: bold;',
        'color: inherit;'
      );

      onProgress?.(100, 'Dönüştürme tamamlandı!');
      return {
        blob: finalBlob,
        ext: 'mp4',
        mimeType: 'video/mp4',
        wasTranscoded: true,
      };
    } catch (transcodeErr: any) {
      console.warn('[StreamMuxer] WebCodecs dönüştürme hatası, kayıpsız passthrough deneniyor:', transcodeErr);
      onProgress?.(25, 'Dönüştürme desteklenmedi, orijinal kayıpsız akış paketleniyor...');
      // Fall through to fast lossless remux below
    }
  }

  // --- FAST LOSSLESS PASSTHROUGH REMUXING (1-2 seconds, zero quality loss) ---
  onProgress?.(15, 'Video ve ses kod çözücü yapılandırmaları alınıyor...');
  const vDec = await videoTrack.getDecoderConfig();
  const aDec = await audioTrack.getDecoderConfig();

  // If not in Mac mode and streams are VP9/Opus, use WebM container; otherwise MP4
  const isWebM = !macCompatibilityMode && (outputExt.toLowerCase() === 'webm' || (videoTrack.codec === 'vp9' && audioTrack.codec === 'opus'));
  const format = isWebM ? new WebMOutputFormat() : new Mp4OutputFormat();

  const target = new BufferTarget();
  const output = new Output({
    format,
    target,
  });

  const videoSource = new EncodedVideoPacketSource(videoTrack.codec as any);
  const audioSource = new EncodedAudioPacketSource(audioTrack.codec as any);

  output.addVideoTrack(videoSource);
  output.addAudioTrack(audioSource);

  onProgress?.(25, 'Kayıpsız birleştirici başlatılıyor...');
  await output.start();

  const videoSink = new EncodedPacketSink(videoTrack);
  const audioSink = new EncodedPacketSink(audioTrack);

  onProgress?.(35, 'Görüntü kareleri kayıpsız paketleniyor...');

  // Pump video packets
  let vCount = 0;
  for await (const packet of videoSink.packets()) {
    videoSource.add(packet, { decoderConfig: vDec || undefined });
    vCount++;
    if (vCount % 200 === 0) {
      onProgress?.(35 + Math.min(30, Math.round(vCount / 100)), `Görüntü kareleri paketleniyor (${vCount} kare)...`);
    }
  }

  onProgress?.(70, 'Ses kareleri kayıpsız paketleniyor...');

  // Pump audio packets
  let aCount = 0;
  for await (const packet of audioSink.packets()) {
    audioSource.add(packet, { decoderConfig: aDec || undefined });
    aCount++;
    if (aCount % 200 === 0) {
      onProgress?.(70 + Math.min(20, Math.round(aCount / 100)), `Ses kareleri paketleniyor (${aCount} kare)...`);
    }
  }

  onProgress?.(92, isWebM ? 'WebM konteyneri mühürleniyor...' : 'MP4 konteyneri mühürleniyor...');
  await output.finalize();

  if (!target.buffer) {
    throw new Error('Birleştirme çıktısı oluşturulamadı.');
  }

  const finalExt: 'mp4' | 'webm' = isWebM ? 'webm' : 'mp4';
  const finalMime = isWebM ? 'video/webm' : 'video/mp4';
  const finalBlob = new Blob([target.buffer], { type: finalMime });

  const finalMb = (finalBlob.size / (1024 * 1024)).toFixed(2);
  console.log(
    `%c[StreamMuxer]%c Tamamlandı: ${vCount} video karesi + ${aCount} ses karesi (${finalExt.toUpperCase()}). Boyut: ${finalMb} MB`,
    'color: #10b981; font-weight: bold;',
    'color: inherit;'
  );

  onProgress?.(100, 'Birleştirme tamamlandı!');
  return {
    blob: finalBlob,
    ext: finalExt,
    mimeType: finalMime,
    wasTranscoded: false,
  };
}

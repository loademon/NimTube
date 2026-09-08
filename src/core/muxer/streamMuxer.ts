import {
  Input,
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  BufferSource,
  ALL_FORMATS,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
} from 'mediabunny';

export interface MuxProgressCallback {
  (percentage: number, statusText: string): void;
}

export interface MuxOptions {
  videoBuffer: ArrayBuffer;
  audioBuffer: ArrayBuffer;
  videoExt?: string;
  audioExt?: string;
  outputExt?: string;
  onProgress?: MuxProgressCallback;
}

export async function losslessMux({
  videoBuffer,
  audioBuffer,
  outputExt = 'mp4',
  onProgress,
}: MuxOptions): Promise<ArrayBuffer> {
  onProgress?.(5, 'Medya akışları ayrıştırılıyor (Demuxing)...');

  const videoInput = new Input({
    source: new BufferSource(videoBuffer),
    formats: ALL_FORMATS,
  });

  const audioInput = new Input({
    source: new BufferSource(audioBuffer),
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
    `%c[StreamMuxer]%c Video codec: ${videoTrack.codec} (${videoTrack.displayWidth}x${videoTrack.displayHeight}), Audio codec: ${audioTrack.codec}`,
    'color: #38bdf8; font-weight: bold;',
    'color: inherit;'
  );

  onProgress?.(15, 'Video ve ses kod çözücü yapılandırmaları alınıyor...');
  const vDec = await videoTrack.getDecoderConfig();
  const aDec = await audioTrack.getDecoderConfig();

  const isWebM = outputExt.toLowerCase() === 'webm' || (videoTrack.codec === 'vp9' && audioTrack.codec === 'opus');
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

  onProgress?.(92, 'MP4 konteyneri mühürleniyor (Finalizing)...');
  await output.finalize();

  if (!target.buffer) {
    throw new Error('Birleştirme çıktısı oluşturulamadı.');
  }

  const finalMb = (target.buffer.byteLength / (1024 * 1024)).toFixed(2);
  console.log(
    `%c[StreamMuxer]%c Tamamlandı: ${vCount} video karesi + ${aCount} ses karesi birleştirildi. Boyut: ${finalMb} MB`,
    'color: #10b981; font-weight: bold;',
    'color: inherit;'
  );

  onProgress?.(100, 'Birleştirme tamamlandı!');
  return target.buffer;
}

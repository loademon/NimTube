import {
  Input,
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  StreamTarget,
  BlobSource,
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
  videoBlob?: Blob | ArrayBuffer;
  videoBuffer?: Blob | ArrayBuffer;
  audioBlob?: Blob | ArrayBuffer;
  audioBuffer?: Blob | ArrayBuffer;
  videoExt?: string;
  audioExt?: string;
  outputExt?: string;
  onProgress?: MuxProgressCallback;
}

export async function losslessMux({
  videoBlob,
  videoBuffer,
  audioBlob,
  audioBuffer,
  outputExt = 'mp4',
  onProgress,
}: MuxOptions): Promise<Blob> {
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
    `%c[StreamMuxer]%c Video codec: ${videoTrack.codec} (${videoTrack.displayWidth}x${videoTrack.displayHeight}), Audio codec: ${audioTrack.codec}`,
    'color: #38bdf8; font-weight: bold;',
    'color: inherit;'
  );

  onProgress?.(15, 'Video ve ses kod çözücü yapılandırmaları alınıyor...');
  const vDec = await videoTrack.getDecoderConfig();
  const aDec = await audioTrack.getDecoderConfig();

  const isWebM = outputExt.toLowerCase() === 'webm' || (videoTrack.codec === 'vp9' && audioTrack.codec === 'opus');
  const format = isWebM ? new WebMOutputFormat() : new Mp4OutputFormat();

  const outputChunks: Uint8Array[] = [];
  const writable = new WritableStream({
    write(entry: { data: Uint8Array }) {
      outputChunks.push(entry.data);
    },
  });

  const target = new StreamTarget(writable, { chunked: true, chunkSize: 1024 * 1024 });

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

  const finalBlob = new Blob(outputChunks as any, { type: isWebM ? 'video/webm' : 'video/mp4' });
  outputChunks.length = 0;

  const finalMb = (finalBlob.size / (1024 * 1024)).toFixed(2);
  console.log(
    `%c[StreamMuxer]%c Tamamlandı: ${vCount} video karesi + ${aCount} ses karesi birleştirildi. Boyut: ${finalMb} MB`,
    'color: #10b981; font-weight: bold;',
    'color: inherit;'
  );

  onProgress?.(100, 'Birleştirme tamamlandı!');
  return finalBlob;
}

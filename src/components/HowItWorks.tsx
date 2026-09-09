import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { translations, Language } from '../core/i18n';

interface HowItWorksProps {
  lang: Language;
  onBack: () => void;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ lang, onBack }) => {
  const [showDeepTech, setShowDeepTech] = useState(false);
  const t = translations[lang].howItWorks;

  return (
    <div className="w-full max-w-2xl mx-auto py-6 sm:py-8 animate-in fade-in duration-150">
      {/* Üst Navigasyon */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={showDeepTech ? () => setShowDeepTech(false) : onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 light:hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{showDeepTech ? (lang === 'tr' ? 'Genel Bakışa Dön' : 'Back to Overview') : t.back}</span>
        </button>
      </div>

      {/* --- GÖRÜNÜM 1: GENEL BAKIŞ (SADE, DOĞAL, DÜZGÜN) --- */}
      {!showDeepTech && (
        <>
          {/* Başlık & Alt Başlık */}
          <div className="mb-10">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100 mb-2">
              {lang === 'tr' ? 'Nasıl Çalışır?' : 'How It Works'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {lang === 'tr'
                ? 'NimTube, harici sunucu olmadan doğrudan tarayıcınızda çalışan bir medya indirme ve birleştirme aracıdır.'
                : 'NimTube is a pure client-side media resolution and muxing tool running entirely in your browser.'}
            </p>
          </div>

          {/* Maddeler */}
          <div className="space-y-6 divide-y divide-zinc-800/60">
            <div className="pt-6 first:pt-0 space-y-1.5">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">01</span>
                <h2 className="text-sm font-medium text-zinc-200">
                  {lang === 'tr'
                    ? 'Kullanıcı IP\'si ve Sıfır Sunucu Yükü'
                    : 'Residential Client IP & Zero Server Overhead'}
                </h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-7">
                {lang === 'tr'
                  ? 'Geleneksel siteler gibi videoları aracı sunuculardan geçirmez. Her HTTP isteği doğrudan kendi tarayıcınız ile YouTube CDN sunucuları arasında gerçekleşir. Bu sayede veri gizliliğiniz korunur ve veri merkezi IP engellemelerine takılmaz.'
                  : 'Does not proxy streams through remote servers. Every byte flows directly between your browser and YouTube CDN, preserving privacy and avoiding datacenter IP bans.'}
              </p>
            </div>

            <div className="pt-6 space-y-1.5">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">02</span>
                <h2 className="text-sm font-medium text-zinc-200">
                  {lang === 'tr'
                    ? 'Mediabunny ve WebAssembly ile 1080p ve 4K Birleştirme'
                    : 'Lossless 1080p & 4K Muxing via Mediabunny & WebAssembly'}
                </h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-7">
                {lang === 'tr'
                  ? 'YouTube, 720p üzerindeki videoları görüntü ve ses olarak ayrı iki dosya halinde sunar. NimTube, modern 64-bit Mediabunny motoru (ve WebAssembly FFmpeg yedeği) sayesinde bu iki akışı yeniden kodlamadan milisaniyeler içinde kayıpsız olarak birleştirir.'
                  : 'YouTube splits resolutions above 720p into separate video and audio streams. NimTube runs an in-browser 64-bit Mediabunny engine (with WebAssembly FFmpeg fallback) to losslessly mux both streams in milliseconds without re-encoding.'}
              </p>
            </div>

            <div className="pt-6 space-y-1.5">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">03</span>
                <h2 className="text-sm font-medium text-zinc-200">
                  {lang === 'tr'
                    ? 'Doğrudan Tarayıcı İndirmesi ve 3 Kademeli Hız Hattı'
                    : 'Direct Native Fetch & 3-Tier Download Pipeline'}
                </h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-7">
                {lang === 'tr'
                  ? 'YouTube tekil indirmelerde hız sınırlaması uygular. NimTube, eklenti destekli Doğrudan Tarayıcı İndirmesi (Direct Native Fetch) ve paralel Range/DASH parçalama havuzunu kullanarak internet hızınızın tamamını (100+ MB/s) kullanır.'
                  : 'YouTube throttles single-stream downloads. NimTube leverages extension-assisted Direct Native Fetch and parallel Range/DASH worker pools to saturate your connection up to 100+ MB/s.'}
              </p>
            </div>

            <div className="pt-6 space-y-1.5">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">04</span>
                <h2 className="text-sm font-medium text-zinc-200">
                  {lang === 'tr'
                    ? 'File System Access ile Doğrudan Diske Yazma'
                    : 'Direct Disk Streaming via File System Access API'}
                </h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-7">
                {lang === 'tr'
                  ? 'Büyük video dosyaları tarayıcının RAM belleğinde biriktirilmez; File System Access API kullanılarak indirilen parçalar anlık olarak diske yazılır ve bellek tüketimi 50 MB altında sabit kalır.'
                  : 'Large video files are not held in browser memory. Using the File System Access API, chunks are written directly to disk as they arrive, keeping RAM usage below 50 MB.'}
              </p>
            </div>
          </div>

          {/* Alt Bağlantı: Kodlu Teknik Detay */}
          <div className="mt-10 pt-6 border-t border-zinc-800/60 flex justify-end">
            <button
              onClick={() => {
                setShowDeepTech(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1.5 transition-colors group"
            >
              <span>{lang === 'tr' ? 'Detaylı Teknik Açıklama & Kodlar' : 'Detailed Technical Specs & Code'}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </>
      )}

      {/* --- GÖRÜNÜM 2: DÜZGÜN, AKICI VE KODLU TEKNİK MAKALE --- */}
      {showDeepTech && (
        <div className="animate-in fade-in duration-150">
          <div className="mb-10">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100 light:text-zinc-900 mb-2">
              {t.deepTech.title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
              {t.deepTech.subtitle}
            </p>
          </div>

          {/* Makale Akışı (Widget kutuları yok; temiz, bölünmüş metin ve kod blokları) */}
          <div className="space-y-12 divide-y divide-zinc-800/60 light:divide-zinc-200">
            {/* 01 */}
            <section className="pt-8 first:pt-0">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">01</span>
                <h2 className="text-sm sm:text-base font-medium text-zinc-100 light:text-zinc-900">
                  {lang === 'tr'
                    ? 'YouTube Oturum Taklidi ve VisionOS İstemci Kimliği'
                    : 'YouTube Session Handshake & VisionOS Client Persona'}
                </h2>
              </div>

              <div className="space-y-3 pl-7 text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
                <p>
                  {lang === 'tr'
                    ? 'YouTube, doğrudan /youtubei/v1/player adresine atılan API isteklerini bot olarak algılar ve "Sign in to confirm you\'re not a bot" yanıtı döner. Bunun sebebi istemcide geçerli bir ziyaretçi kimliği ve oturum çerezi bulunmamasıdır. Web istemcisi taklit edildiğinde ise YouTube karmaşık JavaScript imza çözme (n-sig challenge) algoritmalarını zorunlu tutar.'
                    : 'Direct requests to /youtubei/v1/player are blocked by bot detection. Standard web clients require solving complex JavaScript n-sig signature challenges.'}
                </p>
                <p>
                  {lang === 'tr'
                    ? 'Sistem bu engeli iki aşamalı bir el sıkışma ile çözer: İlk olarak watch sayfasına standart bir GET isteği yapılır ve sayfa kaynağındaki ytcfg objesinden visitorData ile INNERTUBE_API_KEY okunur. İkinci adımda, bu anahtarlar eklenerek Apple Vision Pro (VisionOS) kimliğiyle doğrudan oynatılabilir HTTPS CDN adresleri talep edilir.'
                    : 'We perform a two-stage handshake: extract INNERTUBE_API_KEY and visitorData from the watch HTML, then request streams emulating an Apple Vision Pro (VisionOS) client.'}
                </p>

                <div className="my-3 rounded-lg bg-zinc-950 border border-zinc-800 light:border-zinc-300 overflow-hidden">
                  <pre className="p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    <code>{`// 1. Aşama: Sayfa kaynağından ziyaretçi token'larını okuma
const watchHtml = await fetch(\`https://www.youtube.com/watch?v=\${videoId}\`).then(r => r.text());
const apiKey = watchHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/)[1];
const visitorData = watchHtml.match(/"visitorData":"([^"]+)"/)[1];

// 2. Aşama: VisionOS persona kimliğiyle doğrudan oynatma adresi isteme
const playerRes = await fetch(\`https://www.youtube.com/youtubei/v1/player?key=\${apiKey}\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-YouTube-Client-Name': '101',      // 101 = VisionOS istemci kodu
    'X-YouTube-Client-Version': '1.02',
    'X-Goog-Visitor-Id': visitorData,
  },
  body: JSON.stringify({
    context: {
      client: {
        clientName: 'VISIONOS',
        clientVersion: '1.02',
        deviceMake: 'Apple',
        deviceModel: 'RealityDevice17,1',
        osName: 'visionOS',
        osVersion: '26.5.23O471'
      }
    },
    videoId: videoId
  })
});`}</code>
                  </pre>
                </div>

                <p>
                  {lang === 'tr'
                    ? 'VisionOS istemcisinin tercih edilme nedeni; YouTube\'un bu istemcide n-sig JavaScript şifreleme fonksiyonunu çalıştırmaması ve doğrudan oynatılabilir CDN adreslerini tek seferde dönmesidir.'
                    : 'VisionOS is chosen because YouTube does not enforce n-sig JavaScript signature challenges on this client, returning playable direct CDN URLs immediately.'}
                </p>
              </div>
            </section>

            {/* 02 */}
            <section className="pt-8">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">02</span>
                <h2 className="text-sm sm:text-base font-medium text-zinc-100 light:text-zinc-900">
                  {lang === 'tr'
                    ? 'CORS Kısıtlaması, Declarative Net Request & YouTube İzolasyonu'
                    : 'CORS Restrictions, Declarative Net Request & YouTube Isolation'}
                </h2>
              </div>

              <div className="space-y-3 pl-7 text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
                <p>
                  {lang === 'tr'
                    ? 'Tarayıcıların Aynı Kaynak Politikası (Same-Origin Policy), web sayfalarının doğrudan googlevideo.com adresinden dosya çekmesini engeller; çünkü YouTube CDN sunucuları yanıtlara Access-Control-Allow-Origin başlığı eklemez. Ayrıca JavaScript içinden Origin ve Referer başlıklarını değiştirmek tarayıcı güvenliği gereği yasaklanmıştır (forbidden headers).'
                    : 'Browser Same-Origin Policy forbids web pages from fetching media directly from googlevideo.com. Furthermore, browsers disallow JavaScript from modifying forbidden headers like Origin and Referer.'}
                </p>
                <p>
                  {lang === 'tr'
                    ? 'NimTube Bridge eklentisi bu engeli Manifest V3 Declarative Net Request (DNR) kurallarıyla çözer. İsteklerin başlıkları doğrudan tarayıcının ağ seviyesinde düzenlenir ve yanıtlara gerekli CORS başlıkları enjekte edilir:'
                    : 'NimTube Bridge solves this via Manifest V3 Declarative Net Request rules, rewriting headers directly at the network layer and injecting CORS response headers:'}
                </p>

                <div className="my-3 rounded-lg bg-zinc-950 border border-zinc-800 light:border-zinc-300 overflow-hidden">
                  <pre className="p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    <code>{`// extension/rules/rules.json (Declarative Net Request)
[
  {
    "id": 2,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        { "header": "Origin", "operation": "set", "value": "https://www.youtube.com" },
        { "header": "Referer", "operation": "set", "value": "https://www.youtube.com/" }
      ],
      "responseHeaders": [
        { "header": "Access-Control-Allow-Origin", "operation": "set", "value": "*" },
        { "header": "Access-Control-Allow-Methods", "operation": "set", "value": "GET, HEAD, OPTIONS" },
        { "header": "Access-Control-Expose-Headers", "operation": "set", "value": "Content-Length, Content-Range, Accept-Ranges, x-head-seqnum, x-sequence-num" }
      ]
    },
    "condition": {
      "urlFilter": "*://*.googlevideo.com/*",
      // YouTube'un kendi oynatıcı isteklerine ASLA dokunma (credentials: include koruması):
      "excludedInitiatorDomains": [
        "youtube.com", "youtube-nocookie.com", "google.com", "googlevideo.com", "ytimg.com", "youtu.be"
      ],
      "resourceTypes": ["xmlhttprequest", "media", "other"]
    }
  }
]`}</code>
                  </pre>
                </div>

                <p>
                  {lang === 'tr'
                    ? 'Kritik Güvenlik İzolasyonu: YouTube\'un kendi oynatıcısı video parçalarını çerezlerle (credentials: "include") çeker. CORS standardına göre bu isteklerde Access-Control-Allow-Origin asla "*" olamaz. Eklentimiz excludedInitiatorDomains filtresiyle YouTube alan adlarını tamamen hariç tutar; böylece YouTube\'da normal video izlerken hiçbir çakışma yaşanmaz ve yalnızca NimTube sekmesindeki indirmelerin kısıtlamaları kaldırılır.'
                    : 'Critical Security Isolation: YouTube\'s native player requests video chunks with credentials: "include". Under CORS specifications, wildcard "*" is strictly prohibited on credentialed requests. Our excludedInitiatorDomains filter completely isolates YouTube, preventing any interference with regular YouTube playback while unblocking downloads for NimTube.'}
                </p>
              </div>
            </section>

            {/* 03 */}
            <section className="pt-8">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">03</span>
                <h2 className="text-sm sm:text-base font-medium text-zinc-100 light:text-zinc-900">
                  {lang === 'tr'
                    ? '3 Kademeli Turbo İndirme Hattı ve Hız Kısıtlamasını Aşma'
                    : '3-Tier Turbo Download Pipeline & Throttling Bypass'}
                </h2>
              </div>

              <div className="space-y-3 pl-7 text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
                <p>
                  {lang === 'tr'
                    ? 'YouTube CDN sunucuları, video oynatma adresine gelen tek parça GET isteklerinde hız sınırlaması uygular. İndirme hızı videonun oynatma bit hızına (~150-300 KB/s) sabitlenir. NimTube bu engeli 3 kademeli akıllı indirme mimarisiyle çözer:'
                    : 'YouTube CDN limits single-stream GET downloads to streaming bitrates (~150-300 KB/s). NimTube overcomes this through a resilient 3-tier architecture:'}
                </p>

                <div className="my-3 rounded-lg bg-zinc-950 border border-zinc-800 light:border-zinc-300 overflow-hidden">
                  <pre className="p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    <code>{`// 1. Kademe: Direct Native Fetch (En Yüksek Hız - Sıfır IPC, Sıfır Base64)
// Eklenti CORS başlıklarını eklediği için tarayıcı doğrudan googlevideo.com'a bağlanır
const res = await fetch(segmentUrl, { signal });
const arrayBuffer = await res.arrayBuffer(); // 100+ MB/s hat doyumu!

// 2. Kademe: Eklenti Turbo Batch (DASH Sekansları / Canlı Yayın Parçaları)
// 5000+ parçalı videolarda Service Worker içinde çoklu worker paralel çeker ve birleştirir
const mergedBatch = await fetchSegmentBatchViaExtension(url, startSq, 10);

// 3. Kademe: Paralel Range Havuzu (Eklentisiz Kullanıcılar / Proxy Desteği)
// Range: bytes=0-0 ile boyut anında tespit edilir, 8 MB'lık paralel dilimlerle çekilir
const probe = await fetch(streamUrl, { headers: { 'Range': 'bytes=0-0' } });
const totalBytes = parseInt(probe.headers.get('content-range').split('/')[1], 10);`}</code>
                  </pre>
                </div>

                <p>
                  {lang === 'tr'
                    ? 'Direct Native Fetch devredeyken tarayıcının yerel C++ soket havuzu doğrudan YouTube CDN sunucularına bağlanır. Eklentiyle mesajlaşma (IPC) veya veriyi Base64 string\'e çevirme gecikmesi olmadan internet bant genişliğinizin tamamı kullanılır.'
                    : 'With Direct Native Fetch, Chrome\'s native socket pool connects straight to Google edge servers. Zero IPC overhead and zero Base64 conversion delays unlock your full gigabit connection.'}
                </p>
              </div>
            </section>

            {/* 04 */}
            <section className="pt-8">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">04</span>
                <h2 className="text-sm sm:text-base font-medium text-zinc-100 light:text-zinc-900">
                  {lang === 'tr'
                    ? 'Tarayıcı İçi Kayıpsız Birleştirme: Mediabunny & WebAssembly FFmpeg'
                    : 'Lossless In-Browser Remuxing: Mediabunny & WebAssembly FFmpeg'}
                </h2>
              </div>

              <div className="space-y-3 pl-7 text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
                <p>
                  {lang === 'tr'
                    ? 'YouTube, 720p üzerindeki çözünürlüklerde (1080p, 1440p, 4K) DASH (Dynamic Adaptive Streaming) kullanır. Görüntü parçası (VP9/AV1/H264) ve ses parçası (Opus/AAC) iki ayrı bağlantı olarak sunulur.'
                    : 'YouTube delivers 1080p, 1440p, and 4K streams as separate DASH video and audio tracks.'}
                </p>
                <p>
                  {lang === 'tr'
                    ? 'NimTube, bu iki akışı birleştirmek için birincil motor olarak modern 64-bit Mediabunny kütüphanesini kullanır. Yeniden kodlama (transcoding) yapılmaz; video ve ses paketleri doğrudan kopyalanarak (passthrough) milisaniyeler içinde tek bir MP4 konteyneri halinde mühürlenir:'
                    : 'NimTube uses Mediabunny—a pure 64-bit TypeScript demuxer and muxer—as its primary engine. Packets are copied directly (passthrough) into an MP4 container in milliseconds with zero transcoding:'}
                </p>

                <div className="my-3 rounded-lg bg-zinc-950 border border-zinc-800 light:border-zinc-300 overflow-hidden">
                  <pre className="p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    <code>{`// 1. Mediabunny ile giriş akışlarını ayrıştırma (Demuxing)
const videoInput = new Input({ source: new BufferSource(videoBuffer), formats: ALL_FORMATS });
const audioInput = new Input({ source: new BufferSource(audioBuffer), formats: ALL_FORMATS });

// 2. Kod çözücü konfigürasyonlarını alma ve çıkış akışı oluşturma
const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
output.addVideoTrack(new EncodedVideoPacketSource(videoTrack.codec));
output.addAudioTrack(new EncodedAudioPacketSource(audioTrack.codec));
await output.start();

// 3. Ham paketleri yeniden kodlamadan doğrudan konteynere pompalama
for await (const packet of videoSink.packets()) videoSource.add(packet);
for await (const packet of audioSink.packets()) audioSource.add(packet);
await output.finalize(); // 50 milisaniyede kayıpsız tamamlanır!`}</code>
                  </pre>
                </div>

                <p>
                  {lang === 'tr'
                    ? 'Yeniden kodlama yapılmadığı için işlem saniyenin onda birinde tamamlanır, CPU ve RAM tüketimi minimumda kalır ve orijinal görüntü/ses kalitesinde sıfır kayıp yaşanır. Standart dışı akışlarda ise WebAssembly FFmpeg motoru ikincil yedek (fallback) olarak devreye girer.'
                    : 'Because no transcoding occurs, processing finishes in a fraction of a second with minimal CPU/RAM overhead and zero quality loss. For edge-case streams, an in-browser WebAssembly FFmpeg worker serves as an automatic fallback.'}
                </p>
              </div>
            </section>

            {/* 05 */}
            <section className="pt-8">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">05</span>
                <h2 className="text-sm sm:text-base font-medium text-zinc-100 light:text-zinc-900">
                  {lang === 'tr'
                    ? 'Bellek Yönetimi ve File System Access API ile Diske Akış'
                    : 'Memory Management & Direct Disk Streaming'}
                </h2>
              </div>

              <div className="space-y-3 pl-7 text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
                <p>
                  {lang === 'tr'
                    ? '4K çözünürlükteki videolar 2 GB ile 6 GB arasında yer tutabilir. Tarayıcıların JavaScript heap belleği 2-4 GB civarında sınırlıdır. Tüm parçaları bellekte Blob veya ArrayBuffer olarak bekletmek sekmenin çökmesine (Out of Memory - OOM) yol açar.'
                    : '4K videos range from 2 GB to 6 GB. Storing massive Blobs in JavaScript heap memory crashes browser tabs.'}
                </p>
                <p>
                  {lang === 'tr'
                    ? 'File System Access API destekleyen tarayıcılarda indirilen her 8 MB parça anlık olarak diske yazılır ve RAM belleği hemen boşaltılır:'
                    : 'Using the File System Access API, chunks are written to disk sequentially, freeing RAM instantly:'}
                </p>

                <div className="my-3 rounded-lg bg-zinc-950 border border-zinc-800 light:border-zinc-300 overflow-hidden">
                  <pre className="p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    <code>{`// 1. Kayıt konumu alma
const handle = await window.showSaveFilePicker({
  suggestedName: \`\${title}.mp4\`,
  types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }]
});

// 2. Diske doğrudan yazılabilir akış açma
const writable = await handle.createWritable();

// 3. Parçaları diske basıp RAM'i serbest bırakma
for (const chunk of chunkQueue) {
  await writable.write(chunk.data); // Doğrudan SSD/HDD'ye yazar
  chunk.data = null;                // Bellek anında boşaltılır
}

await writable.close(); // RAM kullanımı 50 MB'ın altında kalır`}</code>
                  </pre>
                </div>
              </div>
            </section>

            {/* 06 */}
            <section className="pt-8">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono text-zinc-500 font-medium">06</span>
                <h2 className="text-sm sm:text-base font-medium text-zinc-100 light:text-zinc-900">
                  {lang === 'tr'
                    ? 'YouTube Oynatıcı DOM Kancası (Sağ Tık Menüsü)'
                    : 'YouTube Player DOM Hook (Context Menu)'}
                </h2>
              </div>

              <div className="space-y-3 pl-7 text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
                <p>
                  {lang === 'tr'
                    ? 'Kullanıcının sürekli video linkini kopyalayıp yapıştırmasını önlemek için eklenti YouTube\'un kendi iç oynatıcı sağ tık menüsüne (.ytp-contextmenu) kancalanır.'
                    : 'To avoid manual link copying, the extension hooks into YouTube\'s in-player context menu.'}
                </p>

                <div className="my-3 rounded-lg bg-zinc-950 border border-zinc-800 light:border-zinc-300 overflow-hidden">
                  <pre className="p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    <code>{`// extension/content.js: YouTube oynatıcı menüsüne kancalanma
const observer = new MutationObserver(() => {
  const menu = document.querySelector('.ytp-contextmenu .ytp-panel-menu');
  if (menu && !menu.querySelector('.nimtube-injected-item')) {
    const item = document.createElement('div');
    item.className = 'ytp-menuitem nimtube-injected-item';
    item.innerHTML = \`
      <div class="ytp-menuitem-icon"><svg height="18" viewBox="0 0 24 24">...</svg></div>
      <div class="ytp-menuitem-label">NimTube ile İndir</div>
      <div class="ytp-menuitem-content"></div>
    \`;

    item.onclick = (e) => {
      e.stopPropagation();
      const videoId = new URLSearchParams(window.location.search).get('v');
      window.open(\`https://nimtube.2615.us/?v=\${videoId}\`, '_blank');
    };

    menu.insertBefore(item, menu.firstChild);
  }
});`}</code>
                  </pre>
                </div>

                <p>
                  {lang === 'tr'
                    ? 'YouTube\'un yerel CSS sınıfları miras alındığı için menü tamamen orijinal oynatıcı görünümüne uyum sağlar; tıklandığında video kimliğini temiz şekilde aktararak indirme akışını başlatır.'
                    : 'Inheriting native YouTube CSS classes ensures natural in-player integration and instant 1-click downloads.'}
                </p>
              </div>
            </section>
          </div>

          {/* Alt Navigasyon */}
          <div className="mt-12 pt-6 border-t border-zinc-800/60 light:border-zinc-200 flex justify-between items-center">
            <button
              onClick={() => {
                setShowDeepTech(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-xs text-zinc-400 hover:text-zinc-100 light:hover:text-zinc-900 transition-colors"
            >
              {lang === 'tr' ? '← Genel Bakışa Dön' : '← Back to Overview'}
            </button>

            <button
              onClick={onBack}
              className="btn-solid px-3.5 py-1.5 rounded-md text-xs font-medium"
            >
              {lang === 'tr' ? 'İndiriciye Dön' : 'Back to Downloader'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

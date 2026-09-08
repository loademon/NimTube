import React, { useState } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  Cpu, 
  HardDrive, 
  Music, 
  Film, 
  ChevronDown, 
  ChevronUp, 
  FileText
} from 'lucide-react';
import type { Language } from '../core/i18n';

interface HomeSeoSectionProps {
  lang: Language;
}

export const HomeSeoSection: React.FC<HomeSeoSectionProps> = ({ lang }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const isTr = lang === 'tr';

  const faqs = isTr ? [
    {
      q: 'NimTube nedir ve diğer YouTube indirme araçlarından farkı nedir?',
      a: 'NimTube, YouTube videolarını harici bir ara sunucu (proxy) üzerinden değil, doğrudan kendi tarayıcınız ve internet bağlantınız üzerinden indiren açık kaynaklı ve istemci taraflı (client-side) bir medya stüdyosudur. Sıfır sunucu maliyeti, sınırsız bant genişliği ve tam gizlilik sağlar.'
    },
    {
      q: '1080p ve 4K videolar nasıl kayıpsız birleştirilir?',
      a: 'YouTube, 720p üzerindeki çözünürlüklerde görüntü ve ses akışlarını ayrı ayrı sunar. NimTube, her iki akışı 4 eşzamanlı paralel worker ile hızla indirir ve tarayıcı içinde çalışan WebAssembly FFmpeg motoru ile saniyeler içinde kalite kaybı olmadan (-c copy) birleştirir.'
    },
    {
      q: 'YouTube videolarını MP3 formatına dönüştürebilir miyim?',
      a: 'Evet! NimTube, YouTube videolarındaki ses akışını çıkarıp 320kbps, 256kbps veya 128kbps kalitesinde kristal netliğinde MP3 ya da orijinal M4A olarak kaydetmenize olanak tanır.'
    },
    {
      q: 'NimTube Bridge eklentisi neden gereklidir ve güvenli midir?',
      a: 'YouTube’un CORS ve IP kısıtlamalarını aşarak videoları doğrudan kendi IP adresinizle çekebilmeniz için hafif bir köprü eklentisi kullanılır. Eklenti tamamen açık kaynaklıdır, VirusTotal üzerinde 0/64 temiz raporuna sahiptir ve hiçbir kişisel verinize veya geçmişinize erişmez.'
    },
    {
      q: 'Büyük 4K dosyalar indirilirken tarayıcımın belleği (RAM) şişer mi?',
      a: 'Hayır. NimTube modern File System Access API kullanarak indirilen veri parçalarını doğrudan diskinize akıtır (stream). Bu sayede 10 GB üzeri devasa 4K 60fps videolarda dahi tarayıcı belleği şişmez ve çökme yaşanmaz.'
    }
  ] : [
    {
      q: 'What is NimTube and how does it differ from other YouTube downloaders?',
      a: 'NimTube is an open-source, client-side media studio that downloads YouTube videos directly using your own browser and internet connection instead of a third-party proxy server. It provides zero server bandwidth, unlimited speeds, and complete privacy.'
    },
    {
      q: 'How does NimTube merge 1080p and 4K videos without quality loss?',
      a: 'YouTube provides high-resolution video and audio streams separately. NimTube downloads both streams via 4 parallel workers and merges them locally using an in-browser WebAssembly FFmpeg engine in seconds without re-encoding (-c copy).'
    },
    {
      q: 'Can I extract and convert YouTube videos to MP3?',
      a: 'Yes! NimTube extracts the audio stream and converts it directly in your browser to crystal-clear 320kbps MP3 or original M4A format.'
    },
    {
      q: 'Why is the NimTube Bridge extension required and is it safe?',
      a: 'To bypass YouTube’s strict CORS and CDN throttling policies, the lightweight bridge extension allows downloads directly from your own IP. It is 100% open source, verified clean (0/64) on VirusTotal, and never accesses personal data or browsing history.'
    },
    {
      q: 'Does downloading huge 4K videos consume all my system RAM?',
      a: 'No. NimTube leverages the File System Access API to stream incoming chunks directly to your storage drive. Even with 10GB+ 4K 60fps videos, browser memory usage remains negligible.'
    }
  ];

  return (
    <section className="w-full mt-10 space-y-12 animate-in fade-in duration-300">
      {/* Hero Headings */}
      <div className="text-center space-y-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">
          {isTr 
            ? 'NimTube — İstemci Taraflı YouTube Video & MP3 İndirici' 
            : 'NimTube — Pure Client-Side YouTube Studio & MP3 Downloader'}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
          {isTr
            ? 'YouTube videolarını harici sunucu kuyruklarına takılmadan, doğrudan kendi bağlantınız üzerinden 4K 60fps, 1080p ve 320kbps MP3 kalitesinde tarayıcınızda indirin.'
            : 'Download YouTube videos in 4K 60fps, 1080p, and convert to 320kbps MP3 directly in your browser without proxy servers, queues, or speed limits.'}
        </p>
      </div>

      {/* 3-Step How-to Guide */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {isTr ? 'Nasıl Kullanılır? (3 Adımda İndirme)' : 'How to Download in 3 Steps'}
          </h2>
          <span className="text-[11px] text-brand-400 font-mono">
            {isTr ? 'Hızlı & Kolay' : 'Fast & Simple'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors space-y-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-zinc-200">
              1
            </div>
            <h3 className="text-sm font-medium text-zinc-200">
              {isTr ? 'Bağlantıyı Yapıştırın' : 'Paste Video URL'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isTr 
                ? 'İndirmek istediğiniz YouTube veya Shorts bağlantısını yukarıdaki arama kutusuna ekleyin.' 
                : 'Copy and paste any YouTube video or Shorts link into the input field above.'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors space-y-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-zinc-200">
              2
            </div>
            <h3 className="text-sm font-medium text-zinc-200">
              {isTr ? 'Kalite & Formatı Seçin' : 'Select Quality & Format'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isTr 
                ? '4K, 1440p, 1080p 60fps video veya kristal netliğinde 320k MP3 ses formatını belirleyin.' 
                : 'Choose your preferred video resolution (4K, 1080p) or extract audio as 320k MP3.'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors space-y-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-zinc-200">
              3
            </div>
            <h3 className="text-sm font-medium text-zinc-200">
              {isTr ? 'Anında İndirin' : 'Direct Stream Download'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isTr 
                ? 'WebAssembly FFmpeg akışları yerel olarak birleştirir ve dosyanız doğrudan diskinize kaydedilir.' 
                : 'WebAssembly FFmpeg muxes streams in your browser and saves directly to disk.'}
            </p>
          </div>
        </div>
      </div>

      {/* Key Architectural Features */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {isTr ? 'Neden NimTube? Öne Çıkan Yetenekler' : 'Why NimTube? Architecture & Performance'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex gap-3.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 h-fit">
              <Zap className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-zinc-200">
                {isTr ? 'Hız Sınırlaması Yok (Throttling Bypass)' : 'Throttling Bypass (Parallel Workers)'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isTr 
                  ? 'YouTube CDN’inin tekil bağlantılarda uyguladığı oynatma hız limitleri, 4 paralel 8 MB parçalı worker mimarisiyle tamamen aşılır.' 
                  : 'Bypasses YouTube’s single-stream CDN throttling using 4 concurrent 8 MB range chunk workers.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex gap-3.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 h-fit">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-zinc-200">
                {isTr ? 'Sıfır Sunucu Bant Genişliği & Tam Gizlilik' : 'Zero Server Bandwidth & Total Privacy'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isTr 
                  ? 'İndirdiğiniz medya asla üçüncü taraf sunuculardan geçmez; doğrudan kendi IP’niz ile YouTube CDN arasında akar.' 
                  : 'Your media never touches any proxy server; streams flow directly between YouTube CDN and your local IP.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex gap-3.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 h-fit">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-zinc-200">
                {isTr ? 'Kayıpsız WebAssembly FFmpeg' : 'Lossless WebAssembly FFmpeg'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isTr 
                  ? 'Ayrık 4K ve 1080p video ve ses akışları tarayıcınızda yeniden kodlama yapılmadan (-c copy) saniyeler içinde birleştirilir.' 
                  : 'Separate 4K/1080p video and audio streams are merged locally with zero transcoding quality loss in seconds.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex gap-3.5">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 h-fit">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-zinc-200">
                {isTr ? 'Doğrudan Diske Akış (RAM Şişmesi Yok)' : 'Direct-to-Disk Stream (Low RAM)'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isTr 
                  ? 'File System Access API ile veriler anında depolama sürücünüze yazılır; 10 GB 4K videolarda bile tarayıcı çökmez.' 
                  : 'File System Access API writes incoming chunks straight to disk, preventing browser memory exhaustion.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Supported Formats Table */}
      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {isTr ? 'Desteklenen Formatlar ve Çözünürlükler' : 'Supported Media Formats & Resolutions'}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/50 flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <div>
              <div className="text-xs font-medium text-zinc-200">4K / 1440p / 1080p</div>
              <div className="text-[10px] text-zinc-400">MP4 (H.264, VP9, AV1)</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/50 flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <div>
              <div className="text-xs font-medium text-zinc-200">MP3 320k / 256k</div>
              <div className="text-[10px] text-zinc-400">{isTr ? 'Kristal Netlikte Ses' : 'High Bitrate Audio'}</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/50 flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <div>
              <div className="text-xs font-medium text-zinc-200">M4A / AAC</div>
              <div className="text-[10px] text-zinc-400">{isTr ? 'Orijinal YouTube Akışı' : 'Original YouTube Stream'}</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/50 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <div>
              <div className="text-xs font-medium text-zinc-200">Altyazı (.srt)</div>
              <div className="text-[10px] text-zinc-400">{isTr ? 'Çok Dilli Altyazılar' : 'Multi-language Subtitles'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sıkça Sorulan Sorular (FAQ Accordion) */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {isTr ? 'Sıkça Sorulan Sorular (SSS)' : 'Frequently Asked Questions (FAQ)'}
        </h2>

        <div className="space-y-2">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-medium text-zinc-200 hover:text-white transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 pt-0 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/40">
                    <p className="mt-2.5">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

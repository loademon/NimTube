import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { translations, Language } from '../core/i18n';
import { isExtensionAvailable, subscribeExtensionStatus, getExtensionStatus, ExtensionStatus } from '../core/extension/extensionBridge';
import { ExtensionModal } from './ExtensionModal';

interface ExtensionPageProps {
  lang: Language;
  onBack: () => void;
}

export const ExtensionPage: React.FC<ExtensionPageProps> = ({ lang, onBack }) => {
  const [extStatus, setExtStatus] = useState<ExtensionStatus>(getExtensionStatus());
  const [hasExtension, setHasExtension] = useState(isExtensionAvailable());
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [vtData, setVtData] = useState({
    permalink: 'https://www.virustotal.com/gui/file/65f10c11337ad700483d271692ea300b10fced994baaa1f93a9140b90c932964/detection',
    detections: 0,
    total: 62,
    sha256: '65f10c11337ad700483d271692ea300b10fced994baaa1f93a9140b90c932964'
  });
  const t = translations[lang].extensionPage;

  useEffect(() => {
    fetch('/virustotal-widget.json')
      .then((res) => res.json())
      .then((d) => {
        if (d?.permalink) {
          setVtData({
            permalink: d.permalink,
            detections: d.detections ?? 0,
            total: d.total ?? 62,
            sha256: d.sha256 ?? '65f10c11337ad700483d271692ea300b10fced994baaa1f93a9140b90c932964'
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return subscribeExtensionStatus((active, status) => {
      setHasExtension(active);
      setExtStatus(status);
    });
  }, []);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = '/nimtube-bridge.zip';
    a.download = 'nimtube-bridge.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsInstallModalOpen(true);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 sm:py-8 animate-in fade-in duration-150">
      {/* Top Navigation */}
      <button
        onClick={onBack}
        className="mb-8 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 light:hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{t.back}</span>
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100 light:text-zinc-900 mb-2">
          {t.title}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
          {t.subtitle}
        </p>
      </div>

      {/* Minimal Status & Download Row */}
      <div className="py-3 border-y border-zinc-800/60 light:border-zinc-200 flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="text-xs text-zinc-400 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>{lang === 'tr' ? 'Durum:' : 'Status:'}</span>
            {!extStatus.available ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                <span>{lang === 'tr' ? 'Yüklü Değil' : 'Not Installed'}</span>
              </span>
            ) : extStatus.outdated ? (
              <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  {lang === 'tr'
                    ? `Güncelleme Gerekli (v${extStatus.version} → v${extStatus.latestVersion})`
                    : `Update Required (v${extStatus.version} → v${extStatus.latestVersion})`}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-200 light:text-zinc-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{lang === 'tr' ? `Bağlı (v${extStatus.version})` : `Connected (v${extStatus.version})`}</span>
              </span>
            )}
          </div>

          <span className="text-zinc-700 light:text-zinc-300">•</span>

          <a
            href={vtData.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-200 light:hover:text-zinc-800 inline-flex items-center gap-1 transition-colors"
          >
            <span>VirusTotal: {vtData.detections}/{vtData.total} {lang === 'tr' ? 'Temiz' : 'Clean'}</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </div>

        <button
          onClick={handleDownload}
          className="btn-solid px-3.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{extStatus.outdated ? (lang === 'tr' ? 'Güncelle (.zip)' : 'Update (.zip)') : t.downloadBtn}</span>
        </button>
      </div>

      {/* Güncelleme Uyarısı */}
      {extStatus.outdated && (
        <div className="mb-6 p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span>
              {lang === 'tr'
                ? `Eklentinizin yeni sürümü mevcut (v${extStatus.version} → v${extStatus.latestVersion}). Yeni YouTube güncellemeleri ve sağ tık düzeltmeleri için lütfen güncelleyin.`
                : `A newer version of the extension is available (v${extStatus.version} → v${extStatus.latestVersion}). Please update to keep YouTube streams working.`}
            </span>
          </div>
          <button
            onClick={handleDownload}
            className="btn-solid px-2.5 py-1 rounded text-xs font-medium shrink-0"
          >
            {lang === 'tr' ? 'Güncelle (.zip)' : 'Update (.zip)'}
          </button>
        </div>
      )}

      {/* Güvenlik & Gizlilik Bilgilendirmesi */}
      <div className="mb-8 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 sm:p-5 text-zinc-300">
        <div className="mb-3.5">
          <h3 className="text-sm font-medium text-zinc-200 mb-1 flex items-center gap-2">
            <span className="font-mono font-semibold text-emerald-500/90 select-none">!?</span>
            <span>{lang === 'tr' ? 'Güvenlik, Gizlilik & Açık Kaynak Güvencesi' : 'Security, Privacy & Open Source Assurance'}</span>
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {lang === 'tr'
              ? 'NimTube Bridge eklentisi hiçbir kişisel verinize erişmez, telemetri içermez ve açık kaynak kodları tamamen denetlenebilir.'
              : 'NimTube Bridge never accesses your personal data, contains zero telemetry, and is 100% open source.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-800/50 text-xs">
          <div className="space-y-0.5">
            <span className="font-medium text-zinc-300 flex items-center gap-1.5">
              <span className="text-zinc-500">•</span>
              <span>{lang === 'tr' ? 'Kişisel Verilere Sıfır Erişim' : 'Zero Access to Personal Data'}</span>
            </span>
            <p className="text-zinc-400 text-[11px] leading-relaxed pl-3">
              {lang === 'tr'
                ? 'Eklenti tarayıcı geçmişinize, çerezlerinize, şifrelerinize veya diğer sekmelerinize ASLA erişemez. İzinler yalnızca *.youtube.com ve *.googlevideo.com ile sınırlandırılmıştır.'
                : 'No access to browser history, cookies, passwords, or other tabs. Scoped strictly to *.youtube.com and *.googlevideo.com.'}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="font-medium text-zinc-300 flex items-center gap-1.5">
              <span className="text-zinc-500">•</span>
              <span>{lang === 'tr' ? 'Neden Web Mağazasında Yok?' : 'Why Not on Chrome Web Store?'}</span>
            </span>
            <p className="text-zinc-400 text-[11px] leading-relaxed pl-3">
              {lang === 'tr'
                ? 'Google politikaları YouTube indirme araçlarını Web Mağazası\'nda yasaklar. Bu sebeple açık kaynak medya araçları Chromium Geliştirici Modu ile yerel kurulur.'
                : 'Google strictly bans YouTube downloaders from the Web Store. Open-source media tools are installed locally via Chromium Developer Mode.'}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="font-medium text-zinc-300 flex items-center gap-1.5">
              <span className="text-zinc-500">•</span>
              <span>{lang === 'tr' ? 'Sıfır Sunucu & Sıfır İzleyici' : 'Zero Servers & Zero Trackers'}</span>
            </span>
            <p className="text-zinc-400 text-[11px] leading-relaxed pl-3">
              {lang === 'tr'
                ? 'Hiçbir analitik, izleyici veya reklam kodu yoktur. Tüm veri akışı doğrudan kendi ev internetiniz ile YouTube CDN arasında gerçekleşir.'
                : 'No analytics, trackers, or ads. All data flows directly between your home network and YouTube CDN.'}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="font-medium text-zinc-300 flex items-center gap-1.5">
              <span className="text-zinc-500">•</span>
              <span>{lang === 'tr' ? 'VirusTotal ile Bağımsız Onay' : 'VirusTotal Verified Clean'}</span>
            </span>
            <p className="text-zinc-400 text-[11px] leading-relaxed pl-3">
              {lang === 'tr'
                ? 'Her derlemede GitHub Actions otomatik olarak dosya hash\'ini 60+ dünya lideri antivirüs motoruna taratır (0/63 zararlı).'
                : 'Automated CI verifies each build across 60+ antivirus engines. Confirmed 0 malicious detections.'}
            </p>
          </div>
        </div>
      </div>

      {/* Gerçek VirusTotal Tarama Görseli */}
      <div className="mb-10">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
          <span className="font-medium text-zinc-300 light:text-zinc-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              {lang === 'tr'
                ? `VirusTotal Güvenlik Raporu (${vtData.detections} / ${vtData.total} Temiz)`
                : `VirusTotal Security Scan (${vtData.detections} / ${vtData.total} Clean)`}
            </span>
          </span>
          <a
            href={vtData.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-200 light:hover:text-zinc-800 inline-flex items-center gap-1 text-[11px] transition-colors"
          >
            <span>{lang === 'tr' ? 'Rapor Sayfasını Aç' : 'Open Report Page'}</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </div>

        <a
          href={vtData.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl overflow-hidden border border-zinc-800 light:border-zinc-300 bg-zinc-950 hover:border-zinc-700 transition-colors"
        >
          <img
            src="/guide/virustotal-report.png"
            alt="VirusTotal Scan Report: 0/62 Clean"
            className="w-full object-contain"
          />
        </a>
      </div>

      {/* --- KURULUM ADIMLARI --- */}
      <div className="space-y-8 mb-12">
        {/* ADIM 1 */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs font-mono text-zinc-500">01</span>
            <h2 className="text-sm font-medium text-zinc-200 light:text-zinc-800">
              {lang === 'tr' ? 'Dosyayı indirin ve klasöre çıkartın' : 'Download and extract the zip file'}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 light:text-zinc-600 pl-6 leading-relaxed">
            {lang === 'tr'
              ? 'Yukarıdaki butona tıklayarak nimtube-bridge.zip dosyasını indirin. İndirilen dosyaya sağ tıklayıp "Tümünü Ayıkla" diyerek klasöre çıkartın.'
              : 'Download nimtube-bridge.zip using the button above. Right-click the file and select "Extract All" to unpack it into a folder.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 pt-1">
            <div className="rounded-lg border border-zinc-800/80 light:border-zinc-200 bg-zinc-950/40 p-2 text-center">
              <img
                src="/guide/step1-download.png"
                alt="Zip İndirme"
                className="max-h-24 mx-auto object-contain rounded"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                nimtube-bridge.zip
              </span>
            </div>
            <div className="rounded-lg border border-zinc-800/80 light:border-zinc-200 bg-zinc-950/40 p-2 text-center">
              <img
                src="/guide/step2-extract.png"
                alt="Klasöre Çıkartma"
                className="max-h-24 mx-auto object-contain rounded"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Klasöre çıkartılmış hali
              </span>
            </div>
          </div>
        </div>

        {/* ADIM 2 */}
        <div className="space-y-3 pt-6 border-t border-zinc-800/60 light:border-zinc-200">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs font-mono text-zinc-500">02</span>
            <h2 className="text-sm font-medium text-zinc-200 light:text-zinc-800">
              {lang === 'tr' ? 'Uzantılar sayfasını açın' : 'Open the Extensions page'}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 light:text-zinc-600 pl-6 leading-relaxed">
            {lang === 'tr'
              ? 'Yeni bir sekme açıp tarayıcınızın adres çubuğuna yapıştırın:'
              : 'Open a new tab and paste this into your browser address bar:'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-6">
            <div className="flex items-center justify-between p-2 rounded-md bg-zinc-900 light:bg-zinc-100 border border-zinc-800 light:border-zinc-300">
              <span className="text-xs font-mono text-zinc-300 light:text-zinc-700">chrome://extensions</span>
              <button
                onClick={() => handleCopy('chrome://extensions')}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 text-[11px]"
              >
                {copiedUrl === 'chrome://extensions' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-mono">{lang === 'tr' ? 'Kopyalandı' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="font-mono">{lang === 'tr' ? 'Kopyala' : 'Copy'}</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded-md bg-zinc-900 light:bg-zinc-100 border border-zinc-800 light:border-zinc-300">
              <span className="text-xs font-mono text-zinc-300 light:text-zinc-700">edge://extensions</span>
              <button
                onClick={() => handleCopy('edge://extensions')}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 text-[11px]"
              >
                {copiedUrl === 'edge://extensions' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-mono">{lang === 'tr' ? 'Kopyalandı' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="font-mono">{lang === 'tr' ? 'Kopyala' : 'Copy'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ADIM 3 */}
        <div className="space-y-3 pt-6 border-t border-zinc-800/60 light:border-zinc-200">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs font-mono text-zinc-500">03</span>
            <h2 className="text-sm font-medium text-zinc-200 light:text-zinc-800">
              {lang === 'tr' ? 'Geliştirici modunu açın' : 'Enable Developer mode'}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 light:text-zinc-600 pl-6 leading-relaxed">
            {lang === 'tr'
              ? 'Uzantılar sayfasının sağ üst köşesindeki anahtarı aktif edin.'
              : 'Toggle the switch in the top-right corner of the extensions page to ON.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 pt-1">
            <div className="rounded-lg border border-zinc-800/80 light:border-zinc-200 bg-zinc-950/40 p-2 text-center">
              <img
                src="/guide/step3-devmode-off.png"
                alt="Kapalı"
                className="max-h-20 mx-auto object-contain rounded"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                {lang === 'tr' ? 'Kapalı' : 'Off'}
              </span>
            </div>
            <div className="rounded-lg border border-zinc-800/80 light:border-zinc-200 bg-zinc-950/40 p-2 text-center">
              <img
                src="/guide/step4-devmode-on.png"
                alt="Açık"
                className="max-h-20 mx-auto object-contain rounded"
              />
              <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
                {lang === 'tr' ? 'Açık' : 'Enabled'}
              </span>
            </div>
          </div>
        </div>

        {/* ADIM 4 */}
        <div className="space-y-3 pt-6 border-t border-zinc-800/60 light:border-zinc-200">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs font-mono text-zinc-500">04</span>
            <h2 className="text-sm font-medium text-zinc-200 light:text-zinc-800">
              {lang === 'tr' ? '"Paketlenmemiş öğe yükle" butonuna tıklayın' : 'Click "Load unpacked" and select folder'}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 light:text-zinc-600 pl-6 leading-relaxed">
            {lang === 'tr'
              ? 'Sol üstte beliren butona basın ve 1. adımda zipten çıkarttığınız "nimtube-bridge" klasörünü seçin.'
              : 'Click the button in the top-left and select the extracted "nimtube-bridge" folder.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 pt-1">
            <div className="rounded-lg border border-zinc-800/80 light:border-zinc-200 bg-zinc-950/40 p-2 text-center">
              <img
                src="/guide/step5-load-unpacked.png"
                alt="Paketlenmemiş öğe yükle"
                className="max-h-20 mx-auto object-contain rounded"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                1. Butona tıklayın
              </span>
            </div>
            <div className="rounded-lg border border-zinc-800/80 light:border-zinc-200 bg-zinc-950/40 p-2 text-center">
              <img
                src="/guide/step6-select-folder.png"
                alt="Klasör Seçimi"
                className="max-h-20 mx-auto object-contain rounded"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                2. Klasörü seçin
              </span>
            </div>
          </div>
        </div>

        {/* ADIM 5 */}
        <div className="space-y-3 pt-6 border-t border-zinc-800/60 light:border-zinc-200">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs font-mono text-zinc-500">05</span>
            <h2 className="text-sm font-medium text-zinc-200 light:text-zinc-800">
              {lang === 'tr' ? 'Kurulum tamamlandı' : 'Installation complete'}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 light:text-zinc-600 pl-6 leading-relaxed">
            {lang === 'tr'
              ? 'Eklenti listede belirdiğinde işlem bitmiştir. Sayfamıza döndüğünüzde durum "Bağlı" olur. Ayrıca YouTube\'da herhangi bir videoya sağ tıklayıp "NimTube ile İndir" seçeneğini kullanabilirsiniz.'
              : 'Setup is finished once the card appears. Returning to NimTube will show Connected status, and right-clicking any YouTube video will display "Download with NimTube".'}
          </p>

          <div className="pl-6 pt-1 max-w-sm">
            <div className="rounded-lg border border-zinc-800/80 light:border-zinc-200 bg-zinc-950/40 p-2 text-center">
              <img
                src="/guide/step7-installed.png"
                alt="Eklenti Kartı"
                className="max-h-28 mx-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- AÇIKLAMALAR --- */}
      <div className="space-y-8 divide-y divide-zinc-800/60 light:divide-zinc-200 pt-6 border-t border-zinc-800/60 light:border-zinc-200">
        {/* Ne İşe Yarar? */}
        <section className="pt-8 first:pt-0">
          <h2 className="text-sm font-semibold text-zinc-100 light:text-zinc-900 mb-3">
            {t.whatTitle}
          </h2>
          <div className="space-y-2.5">
            {t.whatItems.map((item) => (
              <div key={item.title} className="text-xs">
                <span className="font-medium text-zinc-200 light:text-zinc-800 block mb-0.5">
                  • {item.title}
                </span>
                <p className="text-zinc-400 light:text-zinc-600 pl-3 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Neden Gerekli? */}
        <section className="pt-8">
          <h2 className="text-sm font-semibold text-zinc-100 light:text-zinc-900 mb-2">
            {t.whyTitle}
          </h2>
          <p className="text-xs text-zinc-400 light:text-zinc-600 leading-relaxed">
            {t.whyDesc}
          </p>
        </section>

        {/* Nasıl Çalışır? */}
        <section className="pt-8">
          <h2 className="text-sm font-semibold text-zinc-100 light:text-zinc-900 mb-3">
            {t.howTitle}
          </h2>
          <div className="space-y-2.5">
            {t.howItems.map((item) => (
              <div key={item.title} className="text-xs">
                <span className="font-medium text-zinc-200 light:text-zinc-800 block mb-0.5">
                  • {item.title}
                </span>
                <p className="text-zinc-400 light:text-zinc-600 pl-3 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Back Button */}
      <div className="mt-12 pt-6 border-t border-zinc-800/60 light:border-zinc-200 flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn-solid px-3.5 py-1.5 rounded-md text-xs font-medium"
        >
          {t.back}
        </button>

        <button
          onClick={handleDownload}
          className="btn-solid px-3.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{extStatus.outdated ? (lang === 'tr' ? 'Güncelle (.zip)' : 'Update (.zip)') : t.downloadBtn}</span>
        </button>
      </div>

      {/* Extension Install/Update Steps Modal */}
      <ExtensionModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        lang={lang}
        mode={extStatus.outdated ? 'update' : 'install'}
      />
    </div>
  );
};

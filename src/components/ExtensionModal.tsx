import React, { useState, useEffect } from 'react';
import { X, Download, Check, Copy, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { Language } from '../core/i18n';
import { isExtensionAvailable, subscribeExtensionStatus } from '../core/extension/extensionBridge';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onOpenFullPage?: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  isOpen,
  onClose,
  lang,
  onOpenFullPage,
}) => {
  const [hasExtension, setHasExtension] = useState(isExtensionAvailable());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return subscribeExtensionStatus((active) => setHasExtension(active));
  }, []);

  if (!isOpen) return null;

  const handleCopyExtensionsUrl = () => {
    navigator.clipboard.writeText('chrome://extensions');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerDownload = () => {
    const a = document.createElement('a');
    a.href = '/nimtube-bridge.zip';
    a.download = 'nimtube-bridge.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {lang === 'tr' ? 'NimTube Bridge Kurulum Kılavuzu' : 'NimTube Bridge Setup Guide'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {lang === 'tr' ? '30 saniyede doğrudan tarayıcınıza yükleyin' : 'Install locally in 30 seconds'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Download Notice Box */}
          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {lang === 'tr'
                  ? 'nimtube-bridge.zip indirmesi başlatıldı.'
                  : 'nimtube-bridge.zip download started.'}
              </span>
            </div>
            <button
              onClick={triggerDownload}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline shrink-0 transition-colors"
            >
              {lang === 'tr' ? 'İnmediyse Tekrar İndir' : 'Download again'}
            </button>
          </div>

          {/* 4 Step Visual Guide */}
          <div className="space-y-2.5">
            {/* Adım 1 */}
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">01</span>
                <span className="text-xs font-medium text-zinc-200">
                  {lang === 'tr' ? 'Zip Arşivini Klasöre Çıkartın' : 'Extract the Zip File'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-7 leading-relaxed">
                {lang === 'tr'
                  ? 'İndirilen nimtube-bridge.zip dosyasına sağ tıklayın ve "Tümünü Ayıkla" (Extract All) seçeneğiyle klasöre çıkartın.'
                  : 'Right-click the downloaded nimtube-bridge.zip and choose "Extract All" to unpack it into a folder.'}
              </p>
            </div>

            {/* Adım 2 */}
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">02</span>
                  <span className="text-xs font-medium text-zinc-200">
                    {lang === 'tr' ? 'Eklentiler Sayfasını Açın' : 'Open Extensions Page'}
                  </span>
                </div>
                <button
                  onClick={handleCopyExtensionsUrl}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 px-2 py-0.5 rounded transition-colors"
                  title="Kopyala"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">{lang === 'tr' ? 'Kopyalandı' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>chrome://extensions</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 pl-7 leading-relaxed">
                {lang === 'tr'
                  ? 'Tarayıcınızda (Chrome, Edge, Brave, Opera) yeni bir sekme açarak adres çubuğuna chrome://extensions yazın ve Enter\'a basın.'
                  : 'Open a new tab in your Chromium browser and navigate to chrome://extensions.'}
              </p>
            </div>

            {/* Adım 3 */}
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">03</span>
                <span className="text-xs font-medium text-zinc-200">
                  {lang === 'tr' ? 'Geliştirici Modunu Açın' : 'Turn on Developer Mode'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-7 leading-relaxed">
                {lang === 'tr'
                  ? 'Açılan sayfanın sağ üst köşesinde yer alan "Geliştirici modu" (Developer mode) anahtarını açık konuma getirin.'
                  : 'Toggle the "Developer mode" switch in the top-right corner of the extensions page.'}
              </p>
            </div>

            {/* Adım 4 */}
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">04</span>
                <span className="text-xs font-medium text-zinc-200">
                  {lang === 'tr' ? 'Paketlenmemiş Öğe Yükle' : 'Click "Load unpacked"'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 pl-7 leading-relaxed">
                {lang === 'tr'
                  ? 'Sol üstte beliren "Paketlenmemiş öğe yükle" butonuna tıklayın ve 1. adımda çıkarttığınız nimtube-bridge klasörünü seçin.'
                  : 'Click the "Load unpacked" button in the top-left and select the extracted nimtube-bridge folder.'}
              </p>
            </div>
          </div>

          {/* Live Status Feedback Banner */}
          <div className={`p-3 rounded-lg border transition-all ${
            hasExtension
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-zinc-950 border-zinc-800/80 text-zinc-400'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {hasExtension ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-medium text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === 'tr' ? 'Eklenti Başarıyla Bağlandı!' : 'Extension Successfully Connected!'}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>{lang === 'tr' ? 'Eklenti bağlantısı bekleniyor...' : 'Waiting for extension connection...'}</span>
                  </>
                )}
              </div>

              {hasExtension && (
                <span className="text-[11px] text-emerald-400 font-mono">v1.0.2</span>
              )}
            </div>
            {!hasExtension && (
              <p className="text-[11px] text-zinc-500 mt-1 pl-4">
                {lang === 'tr'
                  ? 'Klasörü yüklediğiniz an sayfa otomatik olarak algılayacaktır.'
                  : 'As soon as the folder is loaded, this window will detect it immediately.'}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-zinc-950/80 border-t border-zinc-800/80 flex items-center justify-between">
          {onOpenFullPage ? (
            <button
              onClick={() => {
                onClose();
                onOpenFullPage();
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors"
            >
              <span>{lang === 'tr' ? 'Detaylı Resimli Kılavuz' : 'Full Illustrated Guide'}</span>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="btn-solid px-4 py-1.5 rounded-md text-xs font-medium"
          >
            {hasExtension ? (lang === 'tr' ? 'Hazır, Başla' : 'Done, Let\'s Go') : (lang === 'tr' ? 'Anladım, Kapat' : 'Got it, Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

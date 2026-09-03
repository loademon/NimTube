import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
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

  useEffect(() => {
    return subscribeExtensionStatus((active) => setHasExtension(active));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-300 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 light:border-zinc-200">
          <span className="text-xs font-semibold text-zinc-100 light:text-zinc-900">
            NimTube Bridge
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5">
          {/* Status & Download */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800/60 light:border-zinc-200">
            <div className="text-xs text-zinc-400 flex items-center gap-1.5">
              <span>{lang === 'tr' ? 'Durum:' : 'Status:'}</span>
              {hasExtension ? (
                <div className="flex items-center gap-1.5 text-zinc-200 light:text-zinc-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{lang === 'tr' ? 'Bağlı' : 'Connected'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span>{lang === 'tr' ? 'Yüklü Değil' : 'Not Installed'}</span>
                </div>
              )}
            </div>

            <a
              href="/nimtube-bridge.zip"
              download="nimtube-bridge.zip"
              className="btn-solid px-3 py-1 rounded text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'tr' ? 'İndir (.zip)' : 'Download (.zip)'}</span>
            </a>
          </div>

          {/* Steps */}
          <div className="space-y-1.5 text-xs text-zinc-400 light:text-zinc-600">
            <div className="flex items-start gap-2">
              <span className="font-mono text-zinc-500">1.</span>
              <span>{lang === 'tr' ? 'Zip dosyasını indirip bir klasöre çıkartın.' : 'Download and extract the zip archive.'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-zinc-500">2.</span>
              <span>{lang === 'tr' ? 'chrome://extensions sayfasını açın.' : 'Open chrome://extensions in your browser.'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-zinc-500">3.</span>
              <span>{lang === 'tr' ? 'Sağ üstteki Geliştirici Modu\'nu açın.' : 'Enable Developer Mode in the top-right.'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-zinc-500">4.</span>
              <span>{lang === 'tr' ? '"Paketlenmemiş Öğe Yükle" diyerek klasörü seçin.' : 'Click "Load unpacked" and select the folder.'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-zinc-950/40 light:bg-zinc-50 border-t border-zinc-800/60 light:border-zinc-200 flex justify-end">
          <button
            onClick={onClose}
            className="btn-solid px-3 py-1 rounded text-xs font-medium"
          >
            {lang === 'tr' ? 'Kapat' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

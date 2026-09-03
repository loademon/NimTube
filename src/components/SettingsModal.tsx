import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import type { AppSettings } from '../core/types';
import { translations, Language } from '../core/i18n';
import { isExtensionAvailable, subscribeExtensionStatus, getExtensionStatus, ExtensionStatus } from '../core/extension/extensionBridge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  lang: Language;
  onNavigateToExtension?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  lang,
  onNavigateToExtension,
}) => {
  const [formState, setFormState] = useState<AppSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [extStatus, setExtStatus] = useState<ExtensionStatus>(getExtensionStatus());
  const [hasExtension, setHasExtension] = useState(isExtensionAvailable());

  useEffect(() => {
    return subscribeExtensionStatus((active, status) => {
      setHasExtension(active);
      setExtStatus(status);
    });
  }, []);

  if (!isOpen) return null;

  const t = translations[lang].settings;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formState);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-300 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 light:border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-100 light:text-zinc-900">
            {t.title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4">
          {/* Storage Mode */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300 light:text-zinc-700 block mb-1">
              {t.storageTitle}
            </label>
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-zinc-800 light:border-zinc-200 bg-zinc-950/40 light:bg-zinc-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.useFileSystemAccess}
                onChange={(e) =>
                  setFormState({ ...formState, useFileSystemAccess: e.target.checked })
                }
                className="mt-0.5 accent-zinc-200 rounded"
              />
              <div className="text-xs">
                <span className="font-medium text-zinc-200 light:text-zinc-800 block">
                  {t.storageCheckbox}
                </span>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {t.storageDesc}
                </p>
              </div>
            </label>
          </div>

          {/* Default Audio Bitrate */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300 light:text-zinc-700 block">
              {t.audioQualityTitle}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['320k', '256k', '192k', '128k'] as const).map((rate) => (
                <button
                  type="button"
                  key={rate}
                  onClick={() => setFormState({ ...formState, audioBitrate: rate })}
                  className={`py-1 rounded text-xs font-mono font-medium border transition-colors ${
                    formState.audioBitrate === rate
                      ? 'bg-zinc-200 text-zinc-900 border-zinc-200'
                      : 'border-zinc-800 light:border-zinc-200 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {rate}
                </button>
              ))}
            </div>
          </div>

          {/* Proxy URL (Optional) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300 light:text-zinc-700 block">
              {t.proxyTitle}
            </label>
            <input
              type="text"
              value={formState.corsProxyUrl}
              onChange={(e) => setFormState({ ...formState, corsProxyUrl: e.target.value })}
              placeholder="https://corsproxy.io/?url="
              className="w-full bg-zinc-950/50 light:bg-zinc-50 border border-zinc-800 light:border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 light:text-zinc-800 placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Minimal Extension Status Line */}
          <div className="pt-2 border-t border-zinc-800/60 light:border-zinc-200 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span>{lang === 'tr' ? 'Durum:' : 'Status:'}</span>
              {!extStatus.available ? (
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span>{lang === 'tr' ? 'Yüklü Değil' : 'Not Installed'}</span>
                </div>
              ) : extStatus.outdated ? (
                <div className="flex items-center gap-1.5 text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>{lang === 'tr' ? `Güncelleme Gerekli (v${extStatus.version})` : `Update Required (v${extStatus.version})`}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-200 light:text-zinc-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{lang === 'tr' ? `Bağlı (v${extStatus.version})` : `Connected (v${extStatus.version})`}</span>
                </div>
              )}
            </div>

            {(!extStatus.available || extStatus.outdated) && onNavigateToExtension && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToExtension();
                }}
                className="text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors group"
              >
                <span>{extStatus.outdated ? (lang === 'tr' ? 'Güncelle' : 'Update') : (lang === 'tr' ? 'Eklenti Sayfası' : 'Extension Page')}</span>
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {t.cancel}
            </button>

            <button
              type="submit"
              className="btn-solid px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t.saved}</span>
                </>
              ) : (
                <span>{t.save}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

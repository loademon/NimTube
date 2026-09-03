import React from 'react';
import { X, Trash2, ExternalLink, Clock } from 'lucide-react';
import { HistoryItem, clearHistory } from '../core/storage/history';
import { translations, Language } from '../core/i18n';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onHistoryCleared: () => void;
  lang: Language;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onHistoryCleared,
  lang,
}) => {
  if (!isOpen) return null;

  const t = translations[lang].progress;

  const handleClear = () => {
    clearHistory();
    onHistoryCleared();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-300 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 light:border-zinc-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100 light:text-zinc-900">
              {t.historyTitle}
            </h2>
            <span className="text-[11px] font-mono text-zinc-500">
              ({history.length})
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-zinc-800/60 light:divide-zinc-200">
          {history.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              {t.noHistory}
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3"
              >
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-16 aspect-video object-cover rounded bg-zinc-800 shrink-0"
                  loading="lazy"
                />

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-medium text-zinc-200 light:text-zinc-800 truncate mb-1">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 light:bg-zinc-100 text-zinc-300 light:text-zinc-700">
                      {item.formatLabel}
                    </span>
                    <span>•</span>
                    <span>{new Date(item.timestamp).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <a
                  href={item.originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="YouTube"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-3 border-t border-zinc-800 light:border-zinc-200 flex justify-between items-center bg-zinc-950/40 light:bg-zinc-50">
            <button
              onClick={handleClear}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clearHistory}</span>
            </button>

            <button
              onClick={onClose}
              className="btn-solid px-3 py-1 rounded text-xs font-medium"
            >
              Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ChevronDown, 
  ChevronUp, 
  History 
} from 'lucide-react';
import type { DownloadProgress as DownloadProgressType } from '../core/types';
import { translations, Language } from '../core/i18n';

interface DownloadProgressProps {
  progress: DownloadProgressType;
  onCancel: () => void;
  onOpenHistory: () => void;
  lang: Language;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  progress,
  onCancel,
  onOpenHistory,
  lang,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (progress.stage === 'idle') return null;

  const t = translations[lang].progress;
  const isCompleted = progress.stage === 'completed';
  const isError = progress.stage === 'error';

  // Minimized Compact Pill View
  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 animate-in fade-in duration-150">
        <div className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-300 rounded-full px-3 py-1.5 shadow-xl flex items-center gap-2.5 text-xs text-zinc-100 light:text-zinc-900">
          {!isCompleted && !isError && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
          )}
          {isCompleted && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          {isError && (
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          )}

          {!isError && (
            <span className="font-mono font-semibold">
              %{progress.percentage}
            </span>
          )}

          {progress.speedFormatted && !isCompleted && !isError && (
            <span className="text-[11px] font-mono text-zinc-500">
              {progress.speedFormatted}
            </span>
          )}

          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded-full hover:bg-zinc-800 light:hover:bg-zinc-100 text-zinc-400 hover:text-zinc-200"
            title={t.expand}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded Detailed View
  return (
    <div className="fixed bottom-5 right-5 left-5 sm:left-auto sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-300 rounded-xl p-3.5 shadow-2xl text-zinc-100 light:text-zinc-900">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {!isCompleted && !isError && (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400 shrink-0" />
            )}
            {isCompleted && (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            {isError && (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}

            <span className="text-xs font-medium truncate">
              {progress.statusMessage}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isError && (
              <span className="text-xs font-mono font-semibold">
                %{progress.percentage}
              </span>
            )}

            {/* Minimize button */}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              title={t.minimize}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Cancel button */}
            {!isCompleted && !isError && (
              <button
                onClick={onCancel}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                title={t.cancel}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar line */}
        {!isError && (
          <div className="w-full h-1 bg-zinc-800 light:bg-zinc-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                isCompleted ? 'bg-emerald-500' : 'bg-zinc-200 light:bg-zinc-800'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        )}

        {/* Metrics & History shortcut */}
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div>
            {!isCompleted && !isError && progress.speedFormatted && (
              <span>{progress.speedFormatted}</span>
            )}
            {progress.etaSeconds > 0 && (
              <span className="ml-2">• {progress.etaSeconds}s {t.remaining}</span>
            )}
          </div>

          <button
            onClick={onOpenHistory}
            className="hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            <History className="w-3 h-3" />
            <span>{t.historyTitle}</span>
          </button>
        </div>

        {isError && progress.error && (
          <p className="mt-1.5 text-xs text-red-400 font-mono">
            {progress.error}
          </p>
        )}
      </div>
    </div>
  );
};

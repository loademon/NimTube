import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { translations, Language } from '../core/i18n';

interface ReleaseNotesProps {
  lang: Language;
  onBack: () => void;
}

export const ReleaseNotes: React.FC<ReleaseNotesProps> = ({ lang, onBack }) => {
  const t = translations[lang].releaseNotes;

  return (
    <div className="w-full max-w-2xl mx-auto py-6 sm:py-8 animate-in fade-in duration-150">
      {/* Üst Navigasyon */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.back}</span>
        </button>
      </div>

      {/* Başlık & Alt Başlık */}
      <div className="mb-10">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100 mb-2">
          {t.title}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
          {t.subtitle}
        </p>
      </div>

      {/* Sürümler Listesi */}
      <div className="space-y-8 divide-y divide-zinc-800/60">
        {t.releases.map((rel, idx) => (
          <div key={rel.version} className={idx > 0 ? 'pt-8' : ''}>
            {/* Sürüm Başlığı & Tarih */}
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <div className="flex items-baseline gap-2.5">
                <span className="text-xs font-mono font-medium text-zinc-300">
                  {rel.version}
                </span>
                <span className="text-xs text-zinc-600 font-mono">
                  •
                </span>
                <h2 className="text-sm font-medium text-zinc-200">
                  {rel.title}
                </h2>
              </div>
              <span className="text-xs font-mono text-zinc-500 shrink-0">
                {rel.date}
              </span>
            </div>

            {/* Açıklama */}
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              {rel.summary}
            </p>

            {/* Değişiklik Maddeleri */}
            <ul className="space-y-1.5 text-xs text-zinc-400 leading-relaxed">
              {rel.changes.map((change, cIdx) => (
                <li key={cIdx} className="flex items-start gap-2">
                  <span className="text-zinc-600 select-none">–</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Alt Navigasyon */}
      <div className="mt-12 pt-6 border-t border-zinc-800/60 flex justify-end">
        <button
          onClick={onBack}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {lang === 'tr' ? '← İndiriciye Dön' : '← Back to Downloader'}
        </button>
      </div>
    </div>
  );
};

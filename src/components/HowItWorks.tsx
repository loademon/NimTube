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
      {/* Top Nav */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={showDeepTech ? () => setShowDeepTech(false) : onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 light:hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{showDeepTech ? t.simplePrompt : t.back}</span>
        </button>
      </div>

      {/* --- GÖRÜNÜM 1: GENEL BAKIŞ (SADE) --- */}
      {!showDeepTech && (
        <>
          <div className="mb-10">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100 light:text-zinc-900 mb-2">
              {t.title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
              {t.subtitle}
            </p>
          </div>

          <div className="divide-y divide-zinc-800/60 light:divide-zinc-200">
            {t.features.map((item, idx) => (
              <div key={item.title} className="py-6 first:pt-0 last:pb-0">
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="text-[11px] font-mono text-zinc-500">
                    0{idx + 1}
                  </span>
                  <h2 className="text-sm font-medium text-zinc-200 light:text-zinc-800">
                    {item.title}
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 light:text-zinc-600 leading-relaxed pl-7">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Alt Bağlantı */}
          <div className="mt-12 pt-6 border-t border-zinc-800/60 light:border-zinc-200 flex justify-end">
            <button
              onClick={() => {
                setShowDeepTech(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-xs text-zinc-400 hover:text-zinc-100 light:hover:text-zinc-900 inline-flex items-center gap-1.5 transition-colors group"
            >
              <span>{t.techPrompt}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </>
      )}

      {/* --- GÖRÜNÜM 2: DETAYLI TEKNİK AÇIKLAMA --- */}
      {showDeepTech && (
        <div className="animate-in fade-in duration-150">
          <div className="mb-8">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100 light:text-zinc-900 mb-2">
              {t.deepTech.title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
              {t.deepTech.subtitle}
            </p>
          </div>

          {/* Detaylı Adımlar */}
          <div className="space-y-10 divide-y divide-zinc-800/60 light:divide-zinc-200">
            {t.deepTech.steps.map((step) => (
              <section key={step.number} className="pt-8 first:pt-0">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-xs font-mono text-zinc-500 font-medium">
                    {step.number}
                  </span>
                  <h2 className="text-sm sm:text-base font-semibold text-zinc-100 light:text-zinc-900">
                    {step.title}
                  </h2>
                </div>

                <div className="space-y-3 pl-7 text-xs sm:text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">
                  {step.paragraphs.map((para, pIdx) => (
                    <p key={pIdx}>{para}</p>
                  ))}
                </div>
              </section>
            ))}
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
              {t.simplePrompt}
            </button>

            <button
              onClick={onBack}
              className="btn-solid px-3.5 py-1.5 rounded-lg text-xs font-medium"
            >
              {lang === 'tr' ? 'İndiriciye Dön' : 'Back to Downloader'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

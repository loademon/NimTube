import React from 'react';
import { Settings, History } from 'lucide-react';
import { translations, Language } from '../core/i18n';
import type { AppSettings } from '../core/types';

interface HeaderProps {
  settings: AppSettings;
  lang: Language;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onToggleHistory: () => void;
  onNavigate: (view: 'home' | 'how-it-works' | 'extension') => void;
  onSwitchLanguage: (l: Language) => void;
  activeView: 'home' | 'how-it-works' | 'extension';
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  lang,
  onUpdateSettings,
  onOpenSettings,
  onToggleHistory,
  onNavigate,
  onSwitchLanguage,
  activeView,
}) => {
  const t = translations[lang].nav;

  return (
    <header className="w-full border-b border-zinc-800/60 light:border-zinc-200 transition-colors">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('home')}
            className="text-base font-semibold tracking-tight text-zinc-100 light:text-zinc-900 hover:opacity-85 transition-opacity"
          >
            NimTube
          </button>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => onNavigate(activeView === 'how-it-works' ? 'home' : 'how-it-works')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeView === 'how-it-works'
                  ? 'bg-zinc-800 light:bg-zinc-200 text-zinc-100 light:text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-200 light:hover:text-zinc-800'
              }`}
            >
              {t.howItWorks}
            </button>

            <button
              onClick={() => onNavigate(activeView === 'extension' ? 'home' : 'extension')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeView === 'extension'
                  ? 'bg-zinc-800 light:bg-zinc-200 text-zinc-100 light:text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-200 light:hover:text-zinc-800'
              }`}
            >
              {t.extension}
            </button>
          </nav>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* History Button */}
          <button
            onClick={onToggleHistory}
            className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 light:hover:text-zinc-900 hover:bg-zinc-800/50 light:hover:bg-zinc-100 transition-colors"
            title={t.history}
          >
            <History className="w-4 h-4" />
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => onSwitchLanguage(lang === 'tr' ? 'en' : 'tr')}
            className="px-2 py-1 rounded-md text-xs font-mono font-medium text-zinc-400 hover:text-zinc-100 light:hover:text-zinc-900 hover:bg-zinc-800/50 light:hover:bg-zinc-100 transition-colors"
            title="Dili Değiştir / Change Language"
          >
            {lang.toUpperCase()}
          </button>

          {/* GitHub Repository */}
          <a
            href="https://github.com/loademon/NimTube"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 light:hover:text-zinc-900 hover:bg-zinc-800/50 light:hover:bg-zinc-100 transition-colors"
            title="GitHub Repository"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 light:hover:text-zinc-900 hover:bg-zinc-800/50 light:hover:bg-zinc-100 transition-colors"
            title={t.settings}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

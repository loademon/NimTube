import React from 'react';
import { Settings, Moon, Sun, History } from 'lucide-react';
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

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    onUpdateSettings({ theme: nextTheme });
  };

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

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 light:hover:text-zinc-900 hover:bg-zinc-800/50 light:hover:bg-zinc-100 transition-colors"
            title={settings.theme === 'dark' ? t.lightTheme : t.darkTheme}
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-4 h-4 text-zinc-300" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-600" />
            )}
          </button>

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

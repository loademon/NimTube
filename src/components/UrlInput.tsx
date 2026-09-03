import React, { useState } from 'react';
import { Search, Clipboard, X, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { translations, Language } from '../core/i18n';

interface UrlInputProps {
  onSearch: (url: string) => void;
  isLoading: boolean;
  statusMessage?: string;
  lang: Language;
  initialUrl?: string;
}

export const UrlInput: React.FC<UrlInputProps> = ({
  onSearch,
  isLoading,
  statusMessage,
  lang,
  initialUrl,
}) => {
  const [url, setUrl] = useState(initialUrl || '');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  const t = translations[lang].hero;

  const isValidYoutubeUrl = (input: string): boolean => {
    return /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/.test(
      input
    );
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError(t.emptyUrl);
      return;
    }

    if (!isValidYoutubeUrl(trimmed)) {
      setError(t.invalidUrl);
      return;
    }

    onSearch(trimmed);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      if (isValidYoutubeUrl(text.trim())) {
        setError(null);
        onSearch(text.trim());
      }
    } catch {
      setError(t.clipboardError);
    }
  };

  const handleClear = () => {
    setUrl('');
    setError(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8 sm:py-12">
      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100 light:text-zinc-900 mb-1.5">
          {t.title}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 light:text-zinc-500">
          {t.subtitle}
        </p>
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center bg-zinc-900 light:bg-white rounded-xl border border-zinc-800 light:border-zinc-300 p-1.5 focus-within:border-zinc-500 light:focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-500/20 transition-all shadow-sm">
          <div className="pl-3 pr-2 text-zinc-500">
            <Search className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t.placeholder}
            disabled={isLoading}
            className="w-full bg-transparent border-none text-sm text-zinc-100 light:text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-0 px-2 py-1.5"
          />

          {/* Inline Buttons */}
          <div className="flex items-center gap-1.5 pr-1">
            {url && !isLoading && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                title={t.clear}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {!url && !isLoading && (
              <button
                type="button"
                onClick={handlePaste}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800/80 light:bg-zinc-100 hover:bg-zinc-700/80 light:hover:bg-zinc-200 text-zinc-300 light:text-zinc-700 text-xs font-medium transition-colors"
              >
                <Clipboard className="w-3 h-3 text-zinc-400" />
                <span>{t.paste}</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="btn-solid px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.analyzing}</span>
                </>
              ) : (
                <>
                  <span>{t.analyze}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status text */}
        {isLoading && statusMessage && (
          <div className="mt-2.5 flex items-center justify-center gap-2 text-xs text-zinc-400 font-mono">
            <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/40 px-3 py-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  );
};

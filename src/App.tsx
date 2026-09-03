import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Header } from './components/Header';
import { UrlInput } from './components/UrlInput';
import { VideoCard } from './components/VideoCard';
import { FormatSelector } from './components/FormatSelector';
import { DownloadProgress } from './components/DownloadProgress';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { HowItWorks } from './components/HowItWorks';
import { ExtensionPage } from './components/ExtensionPage';
import { ExtensionModal } from './components/ExtensionModal';
import { engine } from './core/engine';
import { Language } from './core/i18n';
import { getHistory, addToHistory, HistoryItem } from './core/storage/history';
import { isExtensionAvailable, subscribeExtensionStatus, getExtensionStatus, ExtensionStatus } from './core/extension/extensionBridge';
import type { 
  VideoInfo, 
  VideoFormat, 
  SubtitleTrack, 
  DownloadProgress as DownloadProgressType, 
  AppSettings 
} from './core/types';

const DEFAULT_SETTINGS: AppSettings = {
  corsProxyUrl: '',
  customProxyList: [],
  theme: 'dark',
  useFileSystemAccess: true,
  audioBitrate: '320k',
  defaultFormat: 'video_best',
  debugLogs: false,
};

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('nimtube_lang');
    return (saved === 'en' || saved === 'tr') ? saved : 'tr';
  });

  const [activeView, setActiveView] = useState<'home' | 'how-it-works' | 'extension'>('home');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>(getHistory);
  const [extStatus, setExtStatus] = useState<ExtensionStatus>(getExtensionStatus());
  const [hasExtension, setHasExtension] = useState(isExtensionAvailable());
  const [initialSearchUrl, setInitialSearchUrl] = useState('');

  useEffect(() => {
    return subscribeExtensionStatus((active, status) => {
      setHasExtension(active);
      setExtStatus(status);
    });
  }, []);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('nimtube_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressType>({
    stage: 'idle',
    percentage: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    speedFormatted: '',
    etaSeconds: 0,
    statusMessage: '',
  });

  // Save language
  const handleSwitchLanguage = (l: Language) => {
    setLang(l);
    localStorage.setItem('nimtube_lang', l);
  };

  // Save settings & lock to dark mode
  useEffect(() => {
    localStorage.setItem('nimtube_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  // Handle URL search
  const handleSearch = async (url: string) => {
    setIsLoading(true);
    setStatusMessage(lang === 'tr' ? 'Video akışları taranıyor...' : 'Resolving streams...');
    setVideoInfo(null);

    try {
      const info = await engine.extractInfo(url, settings);
      setVideoInfo(info);
      setStatusMessage('');
    } catch (err: any) {
      alert(`Hata: ${err?.message || 'Video bilgileri çözümlenemedi.'}`);
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load URL from query string or hash (triggered by context menu or popup)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v');
    let target = '';

    if (videoId) {
      target = `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      const queryUrl = params.get('url');
      if (queryUrl) {
        target = queryUrl;
      } else if (window.location.hash.startsWith('#url=')) {
        target = decodeURIComponent(window.location.hash.slice(5));
      }
    }

    if (target) {
      setInitialSearchUrl(target);
      handleSearch(target);
    }
  }, []);

  // Video download
  const handleDownloadVideo = async (format: VideoFormat) => {
    if (!videoInfo) return;
    const ok = await engine.downloadVideo(videoInfo, format, settings, (p) => {
      setDownloadProgress(p);
    });

    if (ok) {
      const updated = addToHistory({
        videoId: videoInfo.id,
        title: videoInfo.title,
        thumbnailUrl: videoInfo.thumbnailUrl,
        formatLabel: format.qualityLabel,
        ext: format.ext,
        filesizeFormatted: format.filesizeFormatted,
        originalUrl: videoInfo.originalUrl,
      });
      setHistoryList(updated);
    }
  };

  // Audio download
  const handleDownloadAudio = async (format: VideoFormat, targetType: 'mp3' | 'm4a') => {
    if (!videoInfo) return;
    const ok = await engine.downloadAudio(videoInfo, format, targetType, settings, (p) => {
      setDownloadProgress(p);
    });

    if (ok) {
      const updated = addToHistory({
        videoId: videoInfo.id,
        title: videoInfo.title,
        thumbnailUrl: videoInfo.thumbnailUrl,
        formatLabel: targetType === 'mp3' ? `MP3 (${settings.audioBitrate})` : 'M4A Original',
        ext: targetType,
        originalUrl: videoInfo.originalUrl,
      });
      setHistoryList(updated);
    }
  };

  // Subtitle download
  const handleDownloadSubtitle = async (subtitle: SubtitleTrack) => {
    if (!videoInfo) return;
    const ok = await engine.downloadSubtitle(videoInfo, subtitle, settings);
    if (ok) {
      const updated = addToHistory({
        videoId: videoInfo.id,
        title: `${videoInfo.title} (${subtitle.languageName})`,
        thumbnailUrl: videoInfo.thumbnailUrl,
        formatLabel: `Altyazı (.${subtitle.ext})`,
        ext: subtitle.ext,
        originalUrl: videoInfo.originalUrl,
      });
      setHistoryList(updated);
    }
  };

  // Cancel download
  const handleCancelDownload = () => {
    engine.cancelDownload();
    setDownloadProgress({
      stage: 'idle',
      percentage: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      speedFormatted: '',
      etaSeconds: 0,
      statusMessage: '',
    });
  };

  const isDownloading =
    downloadProgress.stage !== 'idle' &&
    downloadProgress.stage !== 'completed' &&
    downloadProgress.stage !== 'error';

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      {/* Header */}
      <Header
        settings={settings}
        lang={lang}
        onUpdateSettings={(newPartial) => setSettings({ ...settings, ...newPartial })}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleHistory={() => setIsHistoryOpen(true)}
        onNavigate={(view) => setActiveView(view)}
        onSwitchLanguage={handleSwitchLanguage}
        activeView={activeView}
      />

      {/* Main Container */}
      <main className={`flex-1 w-full mx-auto px-4 py-6 flex flex-col justify-start ${activeView === 'extension' ? 'max-w-3xl' : 'max-w-2xl'}`}>
        {activeView === 'extension' ? (
          <ExtensionPage
            lang={lang}
            onBack={() => setActiveView('home')}
          />
        ) : activeView === 'how-it-works' ? (
          <HowItWorks
            lang={lang}
            onBack={() => setActiveView('home')}
          />
        ) : (
          <>
            {/* Warning banner when extension is not installed or requires update */}
            {!extStatus.available ? (
              <div className="mb-4 p-3 rounded-lg border border-amber-900/40 bg-amber-950/20 text-xs text-amber-300 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {lang === 'tr'
                      ? 'Videoları doğrudan kendi IP adresinizle indirmek için NimTube Bridge eklentisi gereklidir.'
                      : 'NimTube Bridge extension is required to download streams directly via your IP.'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = '/nimtube-bridge.zip';
                    a.download = 'nimtube-bridge.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setIsExtensionModalOpen(true);
                  }}
                  className="font-medium hover:text-white shrink-0 text-amber-400 inline-flex items-center gap-1 transition-colors group"
                >
                  <span>{lang === 'tr' ? 'Eklentiyi İndir & Kur' : 'Download & Install Extension'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            ) : extStatus.outdated ? (
              <div className="mb-4 p-3 rounded-lg border border-amber-900/50 bg-amber-950/25 text-xs text-amber-300 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {lang === 'tr'
                      ? `Eklenti güncellemesi gerekiyor (Yüklü: v${extStatus.version} → Güncel: v${extStatus.latestVersion}).`
                      : `Extension update required (Installed: v${extStatus.version} → Latest: v${extStatus.latestVersion}).`}
                  </span>
                </div>

                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = '/nimtube-bridge.zip';
                    a.download = 'nimtube-bridge.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setIsExtensionModalOpen(true);
                  }}
                  className="font-medium hover:text-white shrink-0 text-amber-400 inline-flex items-center gap-1 transition-colors group"
                >
                  <span>{lang === 'tr' ? 'Eklentiyi Güncelle (.zip)' : 'Update Extension (.zip)'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            ) : null}

            <UrlInput
              onSearch={handleSearch}
              isLoading={isLoading}
              statusMessage={statusMessage}
              lang={lang}
              initialUrl={initialSearchUrl}
            />

            {/* Video & Format Details */}
            {videoInfo && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                <VideoCard video={videoInfo} lang={lang} />
                <FormatSelector
                  video={videoInfo}
                  settings={settings}
                  isDownloading={isDownloading}
                  onDownloadVideo={handleDownloadVideo}
                  onDownloadAudio={handleDownloadAudio}
                  onDownloadSubtitle={handleDownloadSubtitle}
                  lang={lang}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Minimizable Progress Toast */}
      <DownloadProgress
        progress={downloadProgress}
        onCancel={handleCancelDownload}
        onOpenHistory={() => setIsHistoryOpen(true)}
        lang={lang}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={historyList}
        onHistoryCleared={() => setHistoryList([])}
        lang={lang}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => setSettings(newSettings)}
        lang={lang}
        onNavigateToExtension={() => {
          setIsSettingsOpen(false);
          setActiveView('extension');
        }}
      />

      {/* Extension Quick Modal */}
      <ExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        lang={lang}
        onOpenFullPage={() => {
          setIsExtensionModalOpen(false);
          setActiveView('extension');
        }}
      />

      {/* Footer */}
      <footer className="w-full py-5 text-center text-xs text-zinc-500 font-normal border-t border-zinc-800/40 light:border-zinc-200 flex items-center justify-center gap-3">
        <span>NimTube for nimnim | powered by </span>
        <a
          href="https://who.loademon.com.tr/"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-400 light:text-zinc-600 hover:text-zinc-200 light:hover:text-zinc-900 underline transition-colors"
        >
          loademon
        </a>
        <span>•</span>
        <a
          href="https://github.com/loademon/NimTube"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-400 light:text-zinc-600 hover:text-zinc-200 light:hover:text-zinc-900 underline transition-colors"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
};
export default App;

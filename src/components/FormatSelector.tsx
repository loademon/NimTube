import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { VideoInfo, VideoFormat, SubtitleTrack, AppSettings } from '../core/types';
import { translations, Language } from '../core/i18n';

interface FormatSelectorProps {
  video: VideoInfo;
  settings: AppSettings;
  isDownloading: boolean;
  onDownloadVideo: (format: VideoFormat) => void;
  onDownloadAudio: (format: VideoFormat, targetType: 'mp3' | 'm4a') => void;
  onDownloadSubtitle: (subtitle: SubtitleTrack) => void;
  onUpdateSettings?: (partial: Partial<AppSettings>) => void;
  lang: Language;
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({
  video,
  settings,
  isDownloading,
  onDownloadVideo,
  onDownloadAudio,
  onDownloadSubtitle,
  onUpdateSettings,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'subtitles'>('video');
  const [selectedMp3Bitrate, setSelectedMp3Bitrate] = useState<'320k' | '256k' | '192k' | '128k'>(
    settings.audioBitrate || '320k'
  );

  const t = translations[lang].formats;

  // Filter unique resolutions
  const uniqueVideoFormats: VideoFormat[] = [];
  const seenLabels = new Set<string>();

  for (const f of video.formats) {
    if (f.hasVideo && !seenLabels.has(f.qualityLabel)) {
      seenLabels.add(f.qualityLabel);
      uniqueVideoFormats.push(f);
    }
  }

  const bestAudioFormat =
    video.audioFormats[0] || video.formats.find((f) => f.hasAudio && !f.hasVideo) || video.formats[0];

  return (
    <div className="pro-card p-4">
      {/* Tab Navigation & Mac Toggle */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1 p-1 bg-zinc-900/90 light:bg-zinc-100 rounded-lg border border-zinc-800/80 light:border-zinc-200">
          <button
            onClick={() => setActiveTab('video')}
            className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
              activeTab === 'video'
                ? 'bg-zinc-800 light:bg-white text-zinc-100 light:text-zinc-900 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.videoTab} ({uniqueVideoFormats.length})
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
              activeTab === 'audio'
                ? 'bg-zinc-800 light:bg-white text-zinc-100 light:text-zinc-900 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.audioTab}
          </button>

          {video.subtitles.length > 0 && (
            <button
              onClick={() => setActiveTab('subtitles')}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === 'subtitles'
                  ? 'bg-zinc-800 light:bg-white text-zinc-100 light:text-zinc-900 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.subtitlesTab} ({video.subtitles.length})
            </button>
          )}
        </div>

        {/* Minimal Mac Toggle */}
        {activeTab === 'video' && (
          <button
            type="button"
            onClick={() => onUpdateSettings?.({ macCompatibilityMode: !settings.macCompatibilityMode })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              settings.macCompatibilityMode
                ? 'bg-zinc-800/90 text-zinc-100 border-zinc-700 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 border-zinc-800/60 bg-transparent'
            }`}
            title={lang === 'tr' ? 'Mac QuickTime için H.264 MP4 modu' : 'Mac QuickTime H.264 MP4 mode'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                settings.macCompatibilityMode
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                  : 'bg-zinc-600'
              }`}
            />
            <span>Mac (MP4)</span>
          </button>
        )}
      </div>

      {/* --- VIDEO TAB --- */}
      {activeTab === 'video' && (
        <div className="divide-y divide-zinc-800/60 light:divide-zinc-200">
          {uniqueVideoFormats.map((format) => {
            const willBeMp4 = settings.macCompatibilityMode || !format.ext?.includes('webm');

            return (
              <div
                key={format.formatId + format.qualityLabel}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs sm:text-sm font-semibold text-zinc-200 light:text-zinc-800">
                    {format.qualityLabel}
                  </span>

                  {format.fps && format.fps >= 50 && (
                    <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/40">
                      {format.fps}fps
                    </span>
                  )}

                  <span className="text-[11px] font-mono text-zinc-500 uppercase">
                    {willBeMp4 ? 'MP4' : 'WEBM'}
                  </span>

                  {format.filesizeFormatted && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      • {format.filesizeFormatted}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onDownloadVideo(format)}
                  disabled={isDownloading}
                  className="btn-solid px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.download}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* --- AUDIO TAB --- */}
      {activeTab === 'audio' && (
        <div className="space-y-3">
          {/* Bitrate Picker for MP3 */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 light:bg-zinc-50 border border-zinc-800/60 light:border-zinc-200">
            <span className="text-xs text-zinc-400">{t.mp3Quality}</span>
            <div className="flex items-center gap-1">
              {(['320k', '256k', '192k', '128k'] as const).map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSelectedMp3Bitrate(rate)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                    selectedMp3Bitrate === rate
                      ? 'bg-zinc-200 text-zinc-900'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {rate}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-zinc-800/60 light:divide-zinc-200">
            {/* MP3 Row */}
            <div className="py-2.5 first:pt-0 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs sm:text-sm font-medium text-zinc-200 light:text-zinc-800">
                  {t.mp3Title}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {selectedMp3Bitrate} • {t.mp3Desc}
                </div>
              </div>

              <button
                onClick={() => onDownloadAudio(bestAudioFormat, 'mp3')}
                disabled={isDownloading}
                className="btn-solid px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.download}</span>
              </button>
            </div>

            {/* M4A Row */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs sm:text-sm font-medium text-zinc-200 light:text-zinc-800">
                  {t.m4aTitle}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {t.m4aDesc}
                </div>
              </div>

              <button
                onClick={() => onDownloadAudio(bestAudioFormat, 'm4a')}
                disabled={isDownloading}
                className="btn-outline px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.download}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTITLES TAB --- */}
      {activeTab === 'subtitles' && (
        <div className="divide-y divide-zinc-800/60 light:divide-zinc-200 max-h-64 overflow-y-auto">
          {video.subtitles.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              {t.noSubtitles}
            </div>
          ) : (
            video.subtitles.map((sub) => (
              <div
                key={sub.languageCode + sub.languageName}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div className="text-xs text-zinc-300 light:text-zinc-700">
                  <span>{sub.languageName}</span>
                  <span className="text-zinc-500 font-mono text-[10px] ml-1.5 uppercase">
                    .{sub.ext}
                  </span>
                </div>

                <button
                  onClick={() => onDownloadSubtitle(sub)}
                  className="btn-outline p-1.5 rounded-md text-zinc-400 hover:text-zinc-200"
                  title={t.download}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { VideoInfo } from '../core/types';
import { translations, Language } from '../core/i18n';

interface VideoCardProps {
  video: VideoInfo;
  lang: Language;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, lang }) => {
  const t = translations[lang].card;

  return (
    <div className="pro-card p-4 mb-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Thumbnail */}
        <div className="relative shrink-0 w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-zinc-800 border border-zinc-800">
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/85 rounded text-[10px] font-mono text-zinc-200">
            {video.durationFormatted}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm sm:text-base font-medium text-zinc-100 light:text-zinc-900 leading-snug line-clamp-2 mb-1.5">
            {video.title}
          </h2>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 light:text-zinc-500">
            <a
              href={video.channelUrl}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-300 light:text-zinc-700 hover:underline flex items-center gap-1 font-medium truncate max-w-[200px]"
            >
              <span>{video.channel}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>

            <span>•</span>
            <span>{video.viewCount.toLocaleString()} {t.views}</span>

            <span>•</span>
            <span>{video.uploadDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

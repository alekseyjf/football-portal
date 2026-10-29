'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PostDetail } from '@/lib/api/types';

type Props = {
  /** Id відео YouTube — з канонічного `videoUrl` (`parseYouTubeVideoId`) */
  videoId: string;
  /** Заголовок — у підписах кнопки й плеєра для екранного диктора; обкладинка — прев'ю */
  post: Pick<PostDetail, 'title' | 'coverImageUrl' | 'coverImageCredit'>;
};

/** Плеєр без cookies YouTube до відтворення; `autoplay` — клік по кнопці вже був. */
function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
}

/** Прев'ю 480×360 є в кожного відео (більші — не завжди); дозволений хост — `images.remotePatterns` у `next.config.ts`. */
function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Фокус — на плеєрі, щойно він з'явився: кнопка, на якій він був, зникла. */
function focusPlayer(player: HTMLIFrameElement | null) {
  player?.focus();
}

function PlayIcon() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 transition-colors group-hover:bg-red-600 group-focus-visible:bg-red-600"
    >
      <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-white">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

/**
 * Прев'ю під кнопкою — найбільший елемент першого екрана (LCP): вантажиться одразу й першим. Обкладинка — як на сайті
 * всюди, без оптимізатора (довільний хост, D44); прев'ю YouTube віддає наш сервер (`next/image`), тож до кліку браузер
 * читача до Google не звертається. `alt=""`: що це, каже підпис кнопки.
 */
function VideoPoster({
  videoId,
  coverImageUrl,
}: {
  videoId: string;
  coverImageUrl: string | null;
}) {
  return (
    <Image
      src={coverImageUrl ?? youtubeThumbnailUrl(videoId)}
      unoptimized={coverImageUrl !== null}
      alt=""
      fill
      loading="eager"
      fetchPriority="high"
      sizes="(min-width: 768px) 768px, 100vw"
      className="object-cover"
    />
  );
}

/**
 * Відео — головне медіа новини замість обкладинки (D54), «фасад»: спершу прев'ю (обкладинка, без неї — картинка YouTube)
 * і кнопка, iframe — лише після кліку: повний плеєр одразу тягнув би сотні КБ скриптів і звертався б до Google від
 * кожного читача. Плеєр — `youtube-nocookie.com` (CSP `frame-src` дозволяє лише його). Підпис автора фото — під
 * блоком, поки прев'ю — обкладинка.
 */
export function PostVideo({ videoId, post }: Props) {
  const t = useTranslations('news');
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <figure className="mb-8">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        {isPlaying ? (
          <iframe
            ref={focusPlayer}
            src={youtubeEmbedUrl(videoId)}
            title={t('videoTitle', { title: post.title })}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            // YouTube вимагає referrer від вбудованого плеєра — інакше відео не відтворюється
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            aria-label={t('playVideo', { title: post.title })}
            className="group absolute inset-0 h-full w-full outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-green-500"
          >
            <VideoPoster videoId={videoId} coverImageUrl={post.coverImageUrl} />
            <PlayIcon />
          </button>
        )}
      </div>
      {!isPlaying && post.coverImageUrl && post.coverImageCredit && (
        <figcaption className="mt-2 text-xs text-gray-400">
          {t('photoCredit', { credit: post.coverImageCredit })}
        </figcaption>
      )}
    </figure>
  );
}

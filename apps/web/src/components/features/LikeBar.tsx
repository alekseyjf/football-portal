'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useLikeStats, useToggleLike } from '@/hooks/useLikes';
import { localeToBcp47 } from '@/lib/i18n/content-lang';
import type { LikeTargetType } from '@/lib/api/types';

function formatCompactCount(value: number, locale: string): string {
  return new Intl.NumberFormat(localeToBcp47(locale), {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

function ThumbUpIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      {filled ? (
        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
      ) : (
        <path d="M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2zm0-12h4l-1.07 4.5c-.1.42-.01.85.25 1.19.26.34.65.54 1.07.55h7l-2.5 5.83H9V9zM1 9h4v12H1V9z" />
      )}
    </svg>
  );
}

function ThumbDownIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      {filled ? (
        <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
      ) : (
        <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm0 12H7.97l2.5-5.83H15v5.83zM19 3v12h4V3h-4z" />
      )}
    </svg>
  );
}

type Props = {
  targetType: LikeTargetType;
  targetId: string;
  /** Менші відступи для вкладених коментарів */
  compact?: boolean;
  className?: string;
};

export function LikeBar({ targetType, targetId, compact, className }: Props) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('likes');
  const { data, isLoading } = useLikeStats(targetType, targetId);
  const { mutate: toggleLike, isPending } = useToggleLike();
  const [blockCode, setBlockCode] = useState<string | null>(null);

  useEffect(() => {
    setBlockCode(null);
  }, [targetType, targetId]);

  const likesCount = data?.likesCount ?? 0;
  const myReaction = data?.myReaction ?? null;
  const likeActive = myReaction === 'LIKE';
  const dislikeActive = myReaction === 'DISLIKE';

  const onReact = (action: 'LIKE' | 'DISLIKE') => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    toggleLike(
      { targetType, targetId, action },
      {
        onError: (error) => {
          const code = error instanceof Error ? error.message : '';
          if (code === 'LIKES_SUSPENDED' || code === 'ACCOUNT_LOCKED') {
            setBlockCode(code);
          }
        },
      },
    );
  };

  const controlsDisabled =
    Boolean(blockCode) || isLoading || isPending;

  const likePad = compact ? 'pl-1.5 pr-0.5 py-0.5' : 'pl-2 pr-0.5 py-1';
  const dislikePad = compact ? 'px-1 py-0.5' : 'px-2 py-1.5';
  const barClass = [
    'inline-flex items-center rounded-full bg-neutral-800/90 border border-neutral-700/80',
    className ?? '',
  ]
    .join(' ')
    .trim();

  const btnBase =
    'inline-flex items-center justify-center rounded-full transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const idle = 'text-neutral-400 hover:bg-neutral-700/80 hover:text-white';
  const activeLike = 'text-sky-400 bg-neutral-700/60';
  const activeDislike = 'text-neutral-100 bg-neutral-700/60';

  return (
    <div className="flex flex-col gap-1">
    <div
      className={barClass}
      role="group"
      aria-label={t('ariaGroup')}
    >
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => onReact('LIKE')}
          className={`${btnBase} ${likePad} rounded-l-full ${likeActive ? activeLike : idle}`}
          aria-pressed={likeActive}
          aria-label={t('like')}
        >
          <ThumbUpIcon filled={likeActive} />
        </button>
        <span
          className={`text-sm font-medium tabular-nums text-neutral-200 pr-1.5 leading-none ${isLoading ? 'opacity-50' : ''}`}
        >
          {formatCompactCount(likesCount, locale)}
        </span>
      </div>
      <span className="w-4 shrink-0" aria-hidden />
      <button
        type="button"
        disabled={controlsDisabled}
        onClick={() => onReact('DISLIKE')}
        className={`${btnBase} ${dislikePad} rounded-r-full ${dislikeActive ? activeDislike : idle}`}
        aria-pressed={dislikeActive}
        aria-label={t('dislike')}
      >
        <ThumbDownIcon filled={dislikeActive} />
      </button>
    </div>
    {blockCode === 'LIKES_SUSPENDED' && (
      <p className="text-xs text-amber-400/95 max-w-xs">{t('likesSuspended')}</p>
    )}
    {blockCode === 'ACCOUNT_LOCKED' && (
      <p className="text-xs text-red-400/95 max-w-xs">{t('accountLocked')}</p>
    )}
    </div>
  );
}

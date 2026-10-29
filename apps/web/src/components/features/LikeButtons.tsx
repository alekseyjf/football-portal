'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/store/auth.store';
import { isApiError } from '@/lib/api/http';
import { localeToBcp47 } from '@/lib/i18n/content-lang';
import type { LikeType } from '@/lib/api/types';

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

/** Помилки голосу, які пояснюємо під кнопками; решта — без тексту. */
const BLOCK_CODES = ['LIKES_SUSPENDED', 'ACCOUNT_LOCKED'] as const;
type BlockCode = (typeof BLOCK_CODES)[number];

function readBlockCode(error: unknown): BlockCode | null {
  if (!isApiError(error)) return null;
  return BLOCK_CODES.find((code) => code === error.code) ?? null;
}

type Props = {
  /** Ціль голосу (`post:<id>`): повідомлення про блокування — лише для неї */
  targetKey: string;
  likesCount: number;
  myReaction: LikeType | null;
  /** Голос відправляється — кнопки вимкнені, щоб кліки не обганяли один одного */
  isPending: boolean;
  /** Стан голосу ще вантажиться (лайки новини й матчу — окремим запитом) */
  isLoading?: boolean;
  /** Менші відступи — у коментарях */
  compact?: boolean;
  className?: string;
  onReact: (action: LikeType) => Promise<unknown>;
};

/** Лайк / дизлайк як на YouTube (Rule 17): публічно — лише кількість лайків; гостя веде на вхід. */
export function LikeButtons({
  targetKey,
  likesCount,
  myReaction,
  isPending,
  isLoading = false,
  compact,
  className,
  onReact,
}: Props) {
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('likes');
  // Код блокування прив'язаний до цілі: інша ціль (той самий екземпляр компонента) — без
  // повідомлення, і без скидання стану в effect
  const [blockState, setBlockState] = useState<{
    targetKey: string;
    code: BlockCode;
  } | null>(null);
  const blockCode =
    blockState?.targetKey === targetKey ? blockState.code : null;

  const likeActive = myReaction === 'LIKE';
  const dislikeActive = myReaction === 'DISLIKE';

  const react = (action: LikeType) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    onReact(action).catch((error: unknown) => {
      const code = readBlockCode(error);
      if (code) setBlockState({ targetKey, code });
    });
  };

  // Поки сесія відновлюється (`GET /auth/me`), `user` ще `null` — клік відправив би
  // залогіненого на сторінку входу
  const controlsDisabled =
    Boolean(blockCode) || isLoading || isPending || isAuthLoading;

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
      <div className={barClass} role="group" aria-label={t('ariaGroup')}>
        <div className="inline-flex items-center gap-0.5">
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => react('LIKE')}
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
          onClick={() => react('DISLIKE')}
          className={`${btnBase} ${dislikePad} rounded-r-full ${dislikeActive ? activeDislike : idle}`}
          aria-pressed={dislikeActive}
          aria-label={t('dislike')}
        >
          <ThumbDownIcon filled={dislikeActive} />
        </button>
      </div>
      {blockCode === 'LIKES_SUSPENDED' && (
        <p className="text-xs text-amber-400/95 max-w-xs">
          {t('likesSuspended')}
        </p>
      )}
      {blockCode === 'ACCOUNT_LOCKED' && (
        <p className="text-xs text-red-400/95 max-w-xs">{t('accountLocked')}</p>
      )}
    </div>
  );
}

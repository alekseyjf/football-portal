'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { PostSummary } from '@/lib/api/types';
import { contentLanguageName } from '@/lib/i18n/content-lang';
import { postPathSegment } from '@/lib/news/post-path';
import { useApiContentLang } from '@/hooks/useApiContentLang';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';
import { PostKickerLink } from './PostKickerLink';

type Props = {
  post: PostSummary;
  /** Рівень заголовка: у стрічці `/news` — 2 (під h1 сторінки), на головній — 3 (під «Останні новини») */
  headingLevel: 2 | 3;
  /** Обкладинка першої картки — найбільший елемент першого екрана (LCP): вантажити одразу й першою */
  isCoverPriority?: boolean;
  /** Після «Завантажити ще» — фокус на заголовку першої нової новини */
  isFocusTarget?: boolean;
};

/** Стабільна функція: React викликає її, лише коли посилання підключається як ціль фокуса. */
function focusTitleLink(titleLink: HTMLAnchorElement | null) {
  titleLink?.focus();
}

/**
 * Картка новини — одна для `/news` і головної (M1.6.1). Уся картка веде в новину: посилання заголовка розтягнуте на
 * неї (`after:inset-0`), а рубрика над ним — окреме посилання у стрічку з фільтром, поверх нього. Посилання в посиланні
 * HTML не дозволяє, а екранний диктор так читає лише заголовок, а не всю картку.
 */
export function NewsCard({
  post,
  headingLevel,
  isCoverPriority = false,
  isFocusTarget = false,
}: Props) {
  const locale = useLocale();
  const contentLang = useApiContentLang();
  const formatDate = useDateTimeFormat();
  const t = useTranslations('feed');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const fallbackNotice =
    post.resolvedLanguage !== contentLang
      ? t('translationUnavailable', {
          language: contentLanguageName(post.resolvedLanguage, locale),
        })
      : null;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl bg-gray-900 transition-colors hover:bg-gray-800">
      {post.coverImageUrl && (
        // `unoptimized`: обкладинка — довільний https-хост із адмінки; оптимізація Next = серверний fetch чужого URL
        // (SSRF, див. API `url-field.decorators.ts`)
        <div className="relative aspect-video w-full" lang={post.resolvedLanguage}>
          <Image
            src={post.coverImageUrl}
            // Опис з адмінки (D44) — мовою тексту картки, звідси `lang`; не заголовок — він і так поруч
            alt={post.coverImageAlt ?? ''}
            fill
            unoptimized
            loading={isCoverPriority ? 'eager' : 'lazy'}
            fetchPriority={isCoverPriority ? 'high' : 'auto'}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        {/* Поверх розтягнутого посилання заголовка (`z-10`) — клікається окремо */}
        <PostKickerLink
          post={post}
          className="relative z-10 mb-2 self-start text-xs font-semibold uppercase tracking-wide text-green-400 hover:text-green-300 hover:underline"
        />
        <Heading
          lang={post.resolvedLanguage}
          className="mb-2 text-lg font-bold leading-snug line-clamp-3"
        >
          <Link
            ref={isFocusTarget ? focusTitleLink : undefined}
            href={`/news/${postPathSegment(post)}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-green-500"
          >
            {post.title}
          </Link>
        </Heading>
        <p
          lang={post.resolvedLanguage}
          className="text-sm text-gray-400 line-clamp-3"
        >
          {post.excerpt}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-gray-500">
          <time dateTime={post.publishedAt}>
            {formatDate(post.publishedAt, { dateStyle: 'medium' })}
          </time>
          {fallbackNotice && (
            <span
              className="rounded border border-gray-700 px-1.5 py-0.5 uppercase tracking-wide text-gray-400"
              title={fallbackNotice}
            >
              <span aria-hidden="true">{post.resolvedLanguage}</span>
              <span className="sr-only">{fallbackNotice}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

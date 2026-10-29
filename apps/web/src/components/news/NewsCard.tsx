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

/**
 * Вигляд картки: `card` — обкладинка зверху (стрічка `/news`); `lead` — головна новина головної сторінки (велике фото,
 * більший заголовок); `row` — мініатюра зліва й без анонсу (головна: телефон і колонка поруч із головною новиною);
 * `rowBelowDesktop` — `row` до 1024 px, далі `card` (D55).
 */
export type NewsCardLayout = 'card' | 'lead' | 'row' | 'rowBelowDesktop';

/**
 * Класи частин картки за виглядом — і для скелетона головної, щоб розміри збігались. Рядки — цілі: Tailwind шукає класи
 * в тексті коду, склеєних з частин він не побачить.
 */
export const NEWS_CARD_LAYOUT_CLASSES: Record<
  NewsCardLayout,
  Record<'article' | 'cover' | 'body' | 'title' | 'excerpt' | 'footer', string>
> = {
  card: {
    article: 'flex-col',
    cover: 'w-full',
    body: 'p-5',
    title: 'mb-2 text-lg',
    excerpt: 'text-sm',
    footer: 'pt-4',
  },
  lead: {
    article: 'flex-col',
    cover: 'w-full',
    body: 'p-5 sm:p-6',
    // На 320 px `text-2xl` обрізав звичайний заголовок на третьому рядку
    title: 'mb-3 text-xl sm:text-2xl lg:text-3xl',
    excerpt: 'text-base',
    footer: 'pt-4',
  },
  row: {
    article: 'flex-row items-start gap-3 p-3',
    cover: 'w-28 shrink-0 overflow-hidden rounded-lg',
    body: 'min-w-0',
    title: 'mb-1 text-base',
    // Анонсу в рядку немає зовсім (картка його не рендерить)
    excerpt: '',
    footer: 'pt-2',
  },
  rowBelowDesktop: {
    article:
      'flex-row items-start gap-3 p-3 lg:flex-col lg:items-stretch lg:gap-0 lg:p-0',
    cover: 'w-28 shrink-0 overflow-hidden rounded-lg lg:w-full lg:rounded-none',
    body: 'min-w-0 lg:p-5',
    title: 'mb-1 text-base lg:mb-2 lg:text-lg',
    excerpt: 'max-lg:hidden text-sm',
    footer: 'pt-2 lg:pt-4',
  },
};

/** Ширина обкладинки на екрані — браузер обирає, яке фото вантажити першим (LCP) */
const COVER_SIZES: Record<NewsCardLayout, string> = {
  card: '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  lead: '(min-width: 1024px) 50vw, 100vw',
  row: '112px',
  rowBelowDesktop: '(min-width: 1024px) 25vw, 112px',
};

type Props = {
  post: PostSummary;
  /** Рівень заголовка: у стрічці `/news` — 2 (під h1 сторінки), на головній — 3 (під «Останні новини») */
  headingLevel: 2 | 3;
  layout?: NewsCardLayout;
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
  layout = 'card',
  isCoverPriority = false,
  isFocusTarget = false,
}: Props) {
  const locale = useLocale();
  const contentLang = useApiContentLang();
  const formatDate = useDateTimeFormat();
  const t = useTranslations('feed');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const classes = NEWS_CARD_LAYOUT_CLASSES[layout];
  const fallbackNotice =
    post.resolvedLanguage !== contentLang
      ? t('translationUnavailable', {
          language: contentLanguageName(post.resolvedLanguage, locale),
        })
      : null;

  return (
    <article
      className={`relative flex h-full overflow-hidden rounded-xl bg-gray-900 transition-colors hover:bg-gray-800 ${classes.article}`}
    >
      {post.coverImageUrl && (
        // `unoptimized`: обкладинка — довільний https-хост із адмінки; оптимізація Next = серверний fetch чужого URL
        // (SSRF, див. API `url-field.decorators.ts`)
        <div
          className={`relative aspect-video ${classes.cover}`}
          lang={post.resolvedLanguage}
        >
          <Image
            src={post.coverImageUrl}
            // Опис з адмінки (D44) — мовою тексту картки, звідси `lang`; не заголовок — він і так поруч
            alt={post.coverImageAlt ?? ''}
            fill
            unoptimized
            loading={isCoverPriority ? 'eager' : 'lazy'}
            fetchPriority={isCoverPriority ? 'high' : 'auto'}
            sizes={COVER_SIZES[layout]}
            className="object-cover"
          />
        </div>
      )}
      <div className={`flex flex-1 flex-col ${classes.body}`}>
        {/* Поверх розтягнутого посилання заголовка (`z-10`) — клікається окремо */}
        <PostKickerLink
          post={post}
          className="relative z-10 mb-2 self-start text-xs font-semibold uppercase tracking-wide text-green-400 hover:text-green-300 hover:underline"
        />
        <Heading
          lang={post.resolvedLanguage}
          className={`font-bold leading-snug line-clamp-3 ${classes.title}`}
        >
          <Link
            ref={isFocusTarget ? focusTitleLink : undefined}
            href={`/news/${postPathSegment(post)}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-green-500"
          >
            {post.title}
          </Link>
        </Heading>
        {layout !== 'row' && (
          <p
            lang={post.resolvedLanguage}
            className={`text-gray-400 line-clamp-3 ${classes.excerpt}`}
          >
            {post.excerpt}
          </p>
        )}
        <div
          className={`mt-auto flex items-center gap-2 text-xs text-gray-500 ${classes.footer}`}
        >
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

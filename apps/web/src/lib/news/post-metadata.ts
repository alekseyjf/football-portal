import type { Metadata } from 'next';
import { isAppLocale, type AppLocale } from '@/i18n/routing';
import type { PostDetail } from '@/lib/api/types';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { postShareCardHref } from '@/lib/seo/share-card';
import { postKicker } from './post-kicker';
import { postHref } from './post-path';

type MetadataSource = Pick<
  PostDetail,
  | 'number'
  | 'slug'
  | 'title'
  | 'excerpt'
  | 'publishedAt'
  | 'lastModifiedAt'
  | 'coverImageUrl'
  | 'coverImageAlt'
  | 'availableLanguages'
  | 'tags'
  | 'competitions'
>;

/** Мови сайту, якими новина є (`hreflang`, canonical): мову, якої сайт не знає, пропускаємо. */
export function postLanguages(
  post: Pick<PostDetail, 'availableLanguages'>,
): AppLocale[] {
  return post.availableLanguages.filter(isAppLocale);
}

/**
 * Метадані новини (M1.6.2, M1.8.1): опис — анонс (D25); `hreflang` — лише мови з перекладом, а сторінка без перекладу
 * (`/uk/…` з англійським текстом) — canonical на EN-версію, без `noindex` (D23, D34). Прев'ю — `og:type=article`:
 * дата, рубрика (як на картці), теги; картинка — обкладинка з описом фото, без неї — згенерована картка з заголовком.
 */
export function postMetadata(
  post: MetadataSource,
  page: { locale: AppLocale; siteName: string; collator: Intl.Collator },
): Metadata {
  return pageMetadata({
    locale: page.locale,
    href: postHref(post),
    title: post.title,
    description: post.excerpt,
    siteName: page.siteName,
    shareCardHref: postShareCardHref(post.number),
    cover: post.coverImageUrl
      ? { url: post.coverImageUrl, alt: post.coverImageAlt }
      : null,
    languages: postLanguages(post),
    article: {
      publishedTime: post.publishedAt,
      // Та сама дата, що `dateModified` у `NewsArticle` і `lastmod` адреси в sitemap (OQ-26)
      modifiedTime: post.lastModifiedAt,
      section: postKicker(post, page.collator)?.name ?? null,
      tags: post.tags.map((tag) => tag.name),
    },
  });
}

import { SITEMAP_MONTH_PATTERN } from '@football-portal/validation';
import { isAppLocale, routing, type AppLocale } from '@/i18n/routing';
import type {
  NewsSitemap,
  PostSitemap,
  PostSitemapIndex,
} from '@/lib/api/types';
import { postHref } from '@/lib/news/post-path';
import {
  absoluteUrl,
  languageAlternates,
  localizedPath,
  type PageHref,
} from './page-metadata';
import type {
  NewsSitemapUrl,
  SitemapIndexEntry,
  SitemapUrl,
} from './sitemap-xml';

/*
 * Що потрапляє в sitemap (D34, D57): адреси й `hreflang` — ті самі функції, що й canonical / `hreflang` сторінок
 * (`page-metadata.ts`); новина — лише мовами, якими вона є (`/uk/…` без перекладу — ні). Повні адреси — від `SITE_URL`.
 */

/** Index — у `robots.txt` (`Sitemap:`) і для Search Console. */
export const SITEMAP_INDEX_PATH = '/sitemap.xml';
export const STATIC_SITEMAP_PATH = '/sitemaps/static.xml';
export const NEWS_SITEMAP_PATH = '/sitemaps/news.xml';
/** Файл місяця — `posts-YYYY-MM.xml` (місяць публікації в UTC, як групує API). */
const POSTS_SITEMAP_FILE = /^posts-(.+)\.xml$/;

/**
 * Сторінки для пошуку без параметрів: головна, стрічка, матчі. Вхід, реєстрація й сторінки з параметрами — `noindex`,
 * тут їх немає; теги — разом зі сторінкою тегу (M2.13), матчі — разом із `SportsEvent` (M2.2).
 */
const STATIC_PAGE_HREFS: readonly PageHref[] = ['/', '/news', '/matches'];

export function postsSitemapPath(month: string): string {
  return `/sitemaps/posts-${month}.xml`;
}

/** `posts-2026-10.xml` → `2026-10`; інша назва чи неіснуючий місяць — `null` (404). */
export function sitemapMonthOf(fileName: string): string | null {
  const month = POSTS_SITEMAP_FILE.exec(fileName)?.[1];
  return month && SITEMAP_MONTH_PATTERN.test(month) ? month : null;
}

function alternatesOf(
  siteOrigin: string,
  href: PageHref,
  languages: readonly AppLocale[],
) {
  return Object.entries(languageAlternates(href, languages)).map(
    ([hreflang, pathname]) => ({
      hreflang,
      href: absoluteUrl(siteOrigin, pathname),
    }),
  );
}

/** Переклади мовами сайту: мову, якої сайт не знає, пропускаємо. */
function withAppLocale<Translation extends { languageCode: string }>(
  translations: readonly Translation[],
): (Translation & { languageCode: AppLocale })[] {
  return translations.filter(
    (translation): translation is Translation & { languageCode: AppLocale } =>
      isAppLocale(translation.languageCode),
  );
}

export function sitemapIndexEntries(
  siteOrigin: string,
  index: PostSitemapIndex,
): SitemapIndexEntry[] {
  return [
    { loc: absoluteUrl(siteOrigin, STATIC_SITEMAP_PATH) },
    { loc: absoluteUrl(siteOrigin, NEWS_SITEMAP_PATH) },
    ...index.months.map((month) => ({
      loc: absoluteUrl(siteOrigin, postsSitemapPath(month.month)),
      lastModified: month.lastModifiedAt,
    })),
  ];
}

export function staticSitemapUrls(siteOrigin: string): SitemapUrl[] {
  return STATIC_PAGE_HREFS.flatMap((href) => {
    const alternates = alternatesOf(siteOrigin, href, routing.locales);
    return routing.locales.map((locale) => ({
      loc: absoluteUrl(siteOrigin, localizedPath(href, locale)),
      alternates,
    }));
  });
}

/** Новина — адреса кожною мовою перекладу, `lastmod` — пізніша з публікації й правки цього перекладу (D57). */
export function postSitemapUrls(
  siteOrigin: string,
  sitemap: PostSitemap,
): SitemapUrl[] {
  return sitemap.posts.flatMap((post) => {
    const href = postHref(post);
    const translations = withAppLocale(post.translations);
    const alternates = alternatesOf(
      siteOrigin,
      href,
      translations.map((translation) => translation.languageCode),
    );
    return translations.map((translation) => ({
      loc: absoluteUrl(
        siteOrigin,
        localizedPath(href, translation.languageCode),
      ),
      lastModified: translation.lastModifiedAt,
      alternates,
    }));
  });
}

/** Google News: новини за 48 год — адреса кожною мовою перекладу з заголовком цією мовою. */
export function newsSitemapUrls(
  siteOrigin: string,
  sitemap: NewsSitemap,
  publicationNames: Record<AppLocale, string>,
): NewsSitemapUrl[] {
  return sitemap.posts.flatMap((post) => {
    const href = postHref(post);
    return withAppLocale(post.translations).map((translation) => ({
      loc: absoluteUrl(
        siteOrigin,
        localizedPath(href, translation.languageCode),
      ),
      publicationName: publicationNames[translation.languageCode],
      language: translation.languageCode,
      publishedAt: post.publishedAt,
      title: translation.title,
    }));
  });
}

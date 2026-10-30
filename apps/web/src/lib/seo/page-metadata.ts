import type { Metadata } from 'next';
import { getPathname } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

/** `og:locale` — мова з регіоном, як чекає Open Graph. */
const OPEN_GRAPH_LOCALE: Record<AppLocale, string> = {
  en: 'en_US',
  uk: 'uk_UA',
};

/** Згенерована картка прев'ю (`lib/seo/og-card.tsx`): 1,91 : 1 — велика картка X, Facebook, Telegram. */
export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;
export const SHARE_CARD_CONTENT_TYPE = 'image/png';

/** Обкладинка новини для прев'ю в соцмережах. */
export type ShareCover = {
  url: string;
  /** Опис фото (D44); `null` — без `og:image:alt` */
  alt: string | null;
};

/** Поля `og:type=article` — лише в новини. */
/** Адреса сторінки без мови — як у `Link` / `getPathname` (`@/i18n/navigation`): рядок або `{ pathname, query }`. */
export type PageHref = Parameters<typeof getPathname>[0]['href'];

export type ArticleMetadata = {
  publishedTime: string;
  modifiedTime: string;
  /** Рубрика новини (як на картці); `null` — без рубрики */
  section: string | null;
  tags: readonly string[];
};

export type PageMetadataSource = {
  locale: AppLocale;
  /**
   * Канонічна адреса сторінки без мови, з query лише своїх параметрів у сталому порядку: `/news?page=2`. Будує її
   * сторінка з уже розібраних параметрів, тож `utm_*` і сміття з адреси запиту сюди не потрапляють.
   */
  href: PageHref;
  /** Назва сторінки — під шаблон сайту (`%s | Назва сайту`, `[locale]/layout.tsx`) */
  title: string;
  /** Назва без шаблону сайту (головна) */
  isTitleAbsolute?: boolean;
  description: string;
  siteName: string;
  /** Адреса згенерованої картки без мови (`/og/post/12`) — прев'ю, коли обкладинки немає */
  shareCardHref: PageHref;
  cover?: ShareCover | null;
  /**
   * Мови, якими сторінка є (`hreflang`); за замовчуванням — усі мови сайту. Мови сторінки серед них немає (новина без
   * перекладу показує текст мовою за замовчуванням) — canonical веде на версію мовою за замовчуванням.
   */
  languages?: readonly AppLocale[];
  /** `false` — `noindex, follow`: читачеві сторінка корисна, а пошуку ні (фільтри, вхід); без `hreflang` */
  isIndexable?: boolean;
  article?: ArticleMetadata;
};

/** Шлях з мовою. Порожній `query` `getPathname` перетворює на `?` у кінці — тож його не передаємо. */
function localizedPath(href: PageHref, locale: AppLocale): string {
  const isEmptyQuery =
    typeof href === 'object' && Object.keys(href.query ?? {}).length === 0;
  return getPathname({
    href: isEmptyQuery ? href.pathname : href,
    locale,
  });
}

/** Мова, якою сторінка насправді написана: мова адреси, а без перекладу — мова за замовчуванням. */
function contentLocaleOf(
  locale: AppLocale,
  languages: readonly AppLocale[],
): AppLocale {
  return languages.includes(locale) ? locale : routing.defaultLocale;
}

/** `hreflang` кожної наявної мови + `x-default` → мова за замовчуванням (D34). */
function languageAlternates(
  href: PageHref,
  languages: readonly AppLocale[],
): Record<string, string> {
  const alternates: Record<string, string> = Object.fromEntries(
    languages.map((language) => [language, localizedPath(href, language)]),
  );
  if (languages.includes(routing.defaultLocale)) {
    alternates['x-default'] = localizedPath(href, routing.defaultLocale);
  }
  return alternates;
}

function shareImage(source: PageMetadataSource, contentLocale: AppLocale) {
  if (source.cover) {
    return { url: source.cover.url, alt: source.cover.alt ?? undefined };
  }
  return {
    url: localizedPath(source.shareCardHref, contentLocale),
    ...SHARE_CARD_SIZE,
    type: SHARE_CARD_CONTENT_TYPE,
    alt: source.title,
  };
}

function openGraphOf(
  source: PageMetadataSource,
  contentLocale: AppLocale,
  canonical: string,
): Metadata['openGraph'] {
  const languages = source.languages ?? routing.locales;
  const common = {
    url: canonical,
    siteName: source.siteName,
    title: source.title,
    description: source.description,
    locale: OPEN_GRAPH_LOCALE[contentLocale],
    alternateLocale: languages
      .filter((language) => language !== contentLocale)
      .map((language) => OPEN_GRAPH_LOCALE[language]),
    images: [shareImage(source, contentLocale)],
  };
  if (!source.article) return { ...common, type: 'website' };
  return {
    ...common,
    type: 'article',
    publishedTime: source.article.publishedTime,
    modifiedTime: source.article.modifiedTime,
    section: source.article.section ?? undefined,
    tags: [...source.article.tags],
  };
}

/**
 * Метадані сторінки сайту — одна функція на всі сторінки (frontend Rule 14, D34): canonical, `hreflang` з
 * `x-default`, `noindex`, Open Graph і картка X. Адреси — шляхи сайту: повні з них робить `metadataBase`
 * (`SITE_URL`, `[locale]/layout.tsx`).
 *
 * - canonical — на себе (і для `?page=N` стрічки, D52; і для фільтрів з `noindex` — інакше Google бачить суперечливі
 *   сигнали); сторінка без перекладу — на версію мовою за замовчуванням (D23).
 * - Картка X — завжди велика: без обкладинки прев'ю — згенерована картка з назвою сторінки й сайту.
 */
export function pageMetadata(source: PageMetadataSource): Metadata {
  const languages = source.languages ?? routing.locales;
  const contentLocale = contentLocaleOf(source.locale, languages);
  const canonical = localizedPath(source.href, contentLocale);
  const isIndexable = source.isIndexable ?? true;

  return {
    title: source.isTitleAbsolute ? { absolute: source.title } : source.title,
    description: source.description,
    alternates: {
      canonical,
      ...(isIndexable
        ? { languages: languageAlternates(source.href, languages) }
        : {}),
    },
    ...(isIndexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: openGraphOf(source, contentLocale, canonical),
    twitter: { card: 'summary_large_image' },
  };
}

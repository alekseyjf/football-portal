import type {
  BreadcrumbList,
  NewsArticle,
  Organization,
  Thing,
  WebSite,
  WithContext,
} from 'schema-dts';

/*
 * Структуровані дані (D34): функції віддають типи `schema-dts` — поле, якого немає в schema.org, чи значення не того
 * типу ловить `tsc`, а не Rich Results Test. На сторінку — лише через `components/seo/JsonLd` (`serializeJsonLd`).
 */

const SCHEMA_ORG_CONTEXT = 'https://schema.org';

/** Будь-який вузол JSON-LD верхнього рівня — те, що приймає `JsonLd`. */
export type JsonLdData = WithContext<Thing>;

/** Видання — сам сайт: назва й адреса (логотип — з брендом, OQ-24). */
export type SitePublisher = { name: string; url: string };

function organizationNode(publisher: SitePublisher) {
  return {
    '@type': 'Organization',
    name: publisher.name,
    url: publisher.url,
  } as const satisfies Organization;
}

/** `Organization` (D55) — видання, на головній; той самий вузол — `publisher` новин і сайту. */
export function organizationJsonLd(
  publisher: SitePublisher,
): WithContext<Organization> {
  return { '@context': SCHEMA_ORG_CONTEXT, ...organizationNode(publisher) };
}

/**
 * `WebSite` (D34, D55) — на головній кожної мови: з нього Google бере назву сайту для результатів пошуку. Без
 * `SearchAction`: пошуку на сайті немає.
 */
export function webSiteJsonLd(site: {
  name: string;
  /** Повна адреса головної цією мовою (`https://…/uk`) */
  url: string;
  inLanguage: string;
  publisher: SitePublisher;
}): WithContext<WebSite> {
  return {
    '@context': SCHEMA_ORG_CONTEXT,
    '@type': 'WebSite',
    name: site.name,
    url: site.url,
    inLanguage: site.inLanguage,
    publisher: organizationNode(site.publisher),
  };
}

/** Пункт хлібних крихт; поточна сторінка — без адреси: Google бере адресу самої сторінки. */
export type BreadcrumbItem = {
  name: string;
  /** Повна адреса (`https://…/uk/news`) */
  url?: string;
};

/** `BreadcrumbList` (D34) — ті самі пункти, що й видимі хлібні крихти сторінки. */
export function breadcrumbListJsonLd(
  items: readonly BreadcrumbItem[],
): WithContext<BreadcrumbList> {
  return {
    '@context': SCHEMA_ORG_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

/** Що потрібно для `NewsArticle`: новина вже в мові тексту, адреси — повні. */
export type NewsArticleSource = {
  /** Повна канонічна адреса новини */
  url: string;
  headline: string;
  description: string;
  /** Обкладинка — обрізання під пропорції Google (`articleImageUrls`); порожньо — без `image` */
  imageUrls: readonly string[];
  datePublished: string;
  /** Пізніша з дати публікації й правки тексту перекладу — та сама, що `lastmod` адреси в sitemap (OQ-26) */
  dateModified: string;
  /** `null` — автора немає (акаунт видалено): автором стає видання */
  authorName: string | null;
  publisher: SitePublisher;
  /** Мова тексту (`resolvedLanguage`): без перекладу — мова оригіналу */
  inLanguage: string;
  /** Джерело новини (D26) */
  sourceUrl: string | null;
};

/**
 * `NewsArticle` (D34) — за ним Google будує блок «Головні новини». Логотип видання — з брендом (OQ-24); `VideoObject` —
 * ні: Google вимагає дату завантаження відео, якої в нас немає (D53).
 */
export function newsArticleJsonLd(
  article: NewsArticleSource,
): WithContext<NewsArticle> {
  const publisher = organizationNode(article.publisher);
  return {
    '@context': SCHEMA_ORG_CONTEXT,
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
    url: article.url,
    headline: article.headline,
    description: article.description,
    ...(article.imageUrls.length > 0 ? { image: article.imageUrls } : {}),
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: [
      article.authorName
        ? { '@type': 'Person', name: article.authorName }
        : publisher,
    ],
    publisher,
    inLanguage: article.inLanguage,
    ...(article.sourceUrl ? { isBasedOn: article.sourceUrl } : {}),
  };
}

/**
 * JSON для `<script type="application/ld+json">`: `<` → `\u003c`, тож текст (заголовок новини з `</script>`) не
 * закриє тег і не почне в ньому HTML-коментар, а JSON-парсер поверне `<` назад. Так радить і Next.js (JSON-LD).
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

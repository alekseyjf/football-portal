const SCHEMA_ORG_CONTEXT = 'https://schema.org';

/** Пункт хлібних крихт; поточна сторінка — без адреси: Google бере адресу самої сторінки. */
export type BreadcrumbItem = {
  name: string;
  /** Повна адреса (`https://…/uk/news`) */
  url?: string;
};

/** `BreadcrumbList` (D34) — ті самі пункти, що й видимі хлібні крихти сторінки. */
export function breadcrumbListJsonLd(items: readonly BreadcrumbItem[]) {
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

/** Що потрібно для `NewsArticle`: новина вже в мові сторінки, адреси — повні. */
export type NewsArticleSource = {
  /** Повна адреса сторінки новини */
  url: string;
  headline: string;
  description: string;
  imageUrl: string | null;
  datePublished: string;
  /** `null` — автора немає (акаунт видалено): автором стає видання */
  authorName: string | null;
  publisher: { name: string; url: string };
  /** Мова тексту (`resolvedLanguage`): без перекладу — мова оригіналу */
  inLanguage: string;
  /** Джерело новини (D26) */
  sourceUrl: string | null;
};

/**
 * `NewsArticle` (D34) — за ним Google будує блок «Головні новини». `dateModified` = дата публікації, поки немає
 * «Оновлено» (OQ-26). Логотип видання — з брендом (OQ-24), відео (`VideoObject`) — у M1.8.
 */
export function newsArticleJsonLd(article: NewsArticleSource) {
  const publisher = {
    '@type': 'Organization',
    name: article.publisher.name,
    url: article.publisher.url,
  };
  return {
    '@context': SCHEMA_ORG_CONTEXT,
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
    url: article.url,
    headline: article.headline,
    description: article.description,
    ...(article.imageUrl ? { image: [article.imageUrl] } : {}),
    datePublished: article.datePublished,
    dateModified: article.datePublished,
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

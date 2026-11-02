/*
 * XML sitemap-ів (sitemaps.org, Google News, M1.8.3) — рядком: формат простий, бібліотека не потрібна. Кожне значення
 * йде через `escapeXml`: адреса з `&` чи заголовок з `<` не ламають файл.
 */

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const NEWS_NAMESPACE = 'http://www.google.com/schemas/sitemap-news/0.9';

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ENTITIES[char]);
}

/** Мовна версія адреси: `hreflang` (`en`, `uk`, `x-default`) → повна адреса. */
export type SitemapAlternate = { hreflang: string; href: string };

export type SitemapUrl = {
  loc: string;
  /** ISO-дата останньої зміни; немає — без `lastmod` (неточний Google ігнорує) */
  lastModified?: string;
  alternates?: readonly SitemapAlternate[];
};

export type SitemapIndexEntry = { loc: string; lastModified?: string };

export type NewsSitemapUrl = {
  loc: string;
  /** Назва видання мовою адреси — як `og:site_name` */
  publicationName: string;
  language: string;
  publishedAt: string;
  title: string;
};

function element(name: string, value: string): string {
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function optionalElement(name: string, value: string | undefined): string {
  return value === undefined ? '' : element(name, value);
}

function alternateLink(alternate: SitemapAlternate): string {
  return `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}"/>`;
}

function document(body: string): string {
  return `${XML_DECLARATION}\n${body}\n`;
}

/** `sitemap.xml` — перелік файлів sitemap. */
export function sitemapIndexXml(entries: readonly SitemapIndexEntry[]): string {
  const sitemaps = entries.map(
    (entry) =>
      `<sitemap>${element('loc', entry.loc)}${optionalElement('lastmod', entry.lastModified)}</sitemap>`,
  );
  return document(
    `<sitemapindex xmlns="${SITEMAP_NAMESPACE}">\n${sitemaps.join('\n')}\n</sitemapindex>`,
  );
}

/** Адреси сторінок з мовними версіями (`xhtml:link` — лише ті, що є, D34). */
export function urlSetXml(urls: readonly SitemapUrl[]): string {
  const entries = urls.map((url) => {
    const alternates = (url.alternates ?? []).map(alternateLink).join('');
    return `<url>${element('loc', url.loc)}${optionalElement('lastmod', url.lastModified)}${alternates}</url>`;
  });
  return document(
    `<urlset xmlns="${SITEMAP_NAMESPACE}" xmlns:xhtml="${XHTML_NAMESPACE}">\n${entries.join('\n')}\n</urlset>`,
  );
}

/** Google News sitemap: на кожну адресу — видання, мова, дата публікації й заголовок. */
export function newsSitemapXml(urls: readonly NewsSitemapUrl[]): string {
  const entries = urls.map(
    (url) =>
      `<url>${element('loc', url.loc)}<news:news><news:publication>${element('news:name', url.publicationName)}${element('news:language', url.language)}</news:publication>${element('news:publication_date', url.publishedAt)}${element('news:title', url.title)}</news:news></url>`,
  );
  return document(
    `<urlset xmlns="${SITEMAP_NAMESPACE}" xmlns:news="${NEWS_NAMESPACE}">\n${entries.join('\n')}\n</urlset>`,
  );
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

/** Сайт закритий від індексації чи такого файла немає. */
export function sitemapNotFound(): Response {
  return new Response(null, { status: 404 });
}

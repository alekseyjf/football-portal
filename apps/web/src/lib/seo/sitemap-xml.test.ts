import { describe, expect, it } from 'vitest';
import {
  escapeXml,
  newsSitemapXml,
  sitemapIndexXml,
  urlSetXml,
} from './sitemap-xml';

describe('XML sitemap-ів (M1.8.3)', () => {
  it('екранує & < > " \' — і в тексті, і в атрибутах', () => {
    expect(escapeXml(`Tom & Jerry <b>"hi"</b> it's`)).toBe(
      'Tom &amp; Jerry &lt;b&gt;&quot;hi&quot;&lt;/b&gt; it&apos;s',
    );
    const xml = urlSetXml([
      {
        loc: 'https://portal.test/en/matches?date=1&league=PL',
        alternates: [
          { hreflang: 'en', href: 'https://portal.test/en?a=1&b="2"' },
        ],
      },
    ]);
    expect(xml).toContain(
      '<loc>https://portal.test/en/matches?date=1&amp;league=PL</loc>',
    );
    expect(xml).toContain(
      'href="https://portal.test/en?a=1&amp;b=&quot;2&quot;"',
    );
  });

  it('адреса: `lastmod` і `xhtml:link` — лише коли є', () => {
    const xml = urlSetXml([
      {
        loc: 'https://portal.test/en/news/derby-42',
        lastModified: '2026-10-30T12:00:00.000Z',
        alternates: [
          { hreflang: 'en', href: 'https://portal.test/en/news/derby-42' },
          { hreflang: 'uk', href: 'https://portal.test/uk/news/derby-42' },
        ],
      },
      { loc: 'https://portal.test/en' },
    ]);
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        '<url><loc>https://portal.test/en/news/derby-42</loc><lastmod>2026-10-30T12:00:00.000Z</lastmod>' +
          '<xhtml:link rel="alternate" hreflang="en" href="https://portal.test/en/news/derby-42"/>' +
          '<xhtml:link rel="alternate" hreflang="uk" href="https://portal.test/uk/news/derby-42"/></url>',
        '<url><loc>https://portal.test/en</loc></url>',
        '</urlset>',
        '',
      ].join('\n'),
    );
  });

  it('Google News: видання, мова, дата й заголовок; заголовок з розміткою не ламає файл', () => {
    const xml = newsSitemapXml([
      {
        loc: 'https://portal.test/uk/news/derby-42',
        publicationName: 'Футбольний портал',
        language: 'uk',
        publishedAt: '2026-10-30T12:00:00.000Z',
        title: 'Арсенал & Челсі: </news:title><script>',
      },
    ]);
    expect(xml).toContain(
      'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
    );
    expect(xml).toContain(
      '<url><loc>https://portal.test/uk/news/derby-42</loc><news:news><news:publication>' +
        '<news:name>Футбольний портал</news:name><news:language>uk</news:language></news:publication>' +
        '<news:publication_date>2026-10-30T12:00:00.000Z</news:publication_date>' +
        '<news:title>Арсенал &amp; Челсі: &lt;/news:title&gt;&lt;script&gt;</news:title></news:news></url>',
    );
  });

  it('index: файли з `lastmod`, де він є', () => {
    expect(
      sitemapIndexXml([
        { loc: 'https://portal.test/sitemaps/static.xml' },
        {
          loc: 'https://portal.test/sitemaps/posts-2026-10.xml',
          lastModified: '2026-10-30T12:00:00.000Z',
        },
      ]),
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '<sitemap><loc>https://portal.test/sitemaps/static.xml</loc></sitemap>',
        '<sitemap><loc>https://portal.test/sitemaps/posts-2026-10.xml</loc><lastmod>2026-10-30T12:00:00.000Z</lastmod></sitemap>',
        '</sitemapindex>',
        '',
      ].join('\n'),
    );
  });
});

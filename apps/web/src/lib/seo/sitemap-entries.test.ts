import { describe, expect, it } from 'vitest';
import {
  newsSitemapUrls,
  postSitemapUrls,
  sitemapIndexEntries,
  sitemapMonthOf,
  staticSitemapUrls,
} from './sitemap-entries';

const SITE = 'https://portal.test';
const PUBLICATION_NAMES = { en: 'Football Portal', uk: 'Футбольний портал' };

function hreflangs(
  alternates: readonly { hreflang: string; href: string }[] = [],
) {
  return Object.fromEntries(
    alternates.map((alternate) => [alternate.hreflang, alternate.href]),
  );
}

describe('Адреси sitemap (M1.8.3)', () => {
  it('статичні сторінки — обома мовами, `hreflang` en, uk і x-default; вхід і реєстрація — ні', () => {
    const urls = staticSitemapUrls(SITE);
    expect(urls.map((url) => url.loc)).toEqual([
      'https://portal.test/en',
      'https://portal.test/uk',
      'https://portal.test/en/news',
      'https://portal.test/uk/news',
      'https://portal.test/en/matches',
      'https://portal.test/uk/matches',
    ]);
    expect(hreflangs(urls[3].alternates)).toEqual({
      en: 'https://portal.test/en/news',
      uk: 'https://portal.test/uk/news',
      'x-default': 'https://portal.test/en/news',
    });
  });

  it('новина з перекладом — адреса кожною мовою з її `lastmod`; без UK-перекладу — `/uk/…` у sitemap немає', () => {
    const urls = postSitemapUrls(SITE, {
      posts: [
        {
          number: 42,
          slug: 'arsenal-win-the-derby',
          translations: [
            { languageCode: 'en', lastModifiedAt: '2026-10-30T12:00:00.000Z' },
            { languageCode: 'uk', lastModifiedAt: '2026-10-31T08:00:00.000Z' },
          ],
        },
        {
          number: 43,
          slug: 'english-only',
          translations: [
            { languageCode: 'en', lastModifiedAt: '2026-10-30T13:00:00.000Z' },
            // Мова, якої сайт не знає, — поза sitemap
            { languageCode: 'de', lastModifiedAt: '2026-10-30T13:00:00.000Z' },
          ],
        },
      ],
    });

    expect(
      urls.map((url) => [url.loc, url.lastModified, hreflangs(url.alternates)]),
    ).toEqual([
      [
        'https://portal.test/en/news/arsenal-win-the-derby-42',
        '2026-10-30T12:00:00.000Z',
        {
          en: 'https://portal.test/en/news/arsenal-win-the-derby-42',
          uk: 'https://portal.test/uk/news/arsenal-win-the-derby-42',
          'x-default': 'https://portal.test/en/news/arsenal-win-the-derby-42',
        },
      ],
      [
        'https://portal.test/uk/news/arsenal-win-the-derby-42',
        '2026-10-31T08:00:00.000Z',
        {
          en: 'https://portal.test/en/news/arsenal-win-the-derby-42',
          uk: 'https://portal.test/uk/news/arsenal-win-the-derby-42',
          'x-default': 'https://portal.test/en/news/arsenal-win-the-derby-42',
        },
      ],
      [
        'https://portal.test/en/news/english-only-43',
        '2026-10-30T13:00:00.000Z',
        {
          en: 'https://portal.test/en/news/english-only-43',
          'x-default': 'https://portal.test/en/news/english-only-43',
        },
      ],
    ]);
  });

  it('Google News — на кожну адресу видання й мова адреси, дата публікації, заголовок цією мовою', () => {
    expect(
      newsSitemapUrls(
        SITE,
        {
          posts: [
            {
              number: 42,
              slug: 'arsenal-win-the-derby',
              publishedAt: '2026-10-30T12:00:00.000Z',
              translations: [
                { languageCode: 'en', title: 'Arsenal win the derby' },
                { languageCode: 'uk', title: 'Арсенал виграв дербі' },
              ],
            },
          ],
        },
        PUBLICATION_NAMES,
      ),
    ).toEqual([
      {
        loc: 'https://portal.test/en/news/arsenal-win-the-derby-42',
        publicationName: 'Football Portal',
        language: 'en',
        publishedAt: '2026-10-30T12:00:00.000Z',
        title: 'Arsenal win the derby',
      },
      {
        loc: 'https://portal.test/uk/news/arsenal-win-the-derby-42',
        publicationName: 'Футбольний портал',
        language: 'uk',
        publishedAt: '2026-10-30T12:00:00.000Z',
        title: 'Арсенал виграв дербі',
      },
    ]);
  });

  it('index — статичні сторінки, Google News і місяці з `lastmod`', () => {
    expect(
      sitemapIndexEntries(SITE, {
        months: [
          {
            month: '2026-10',
            postCount: 3,
            lastModifiedAt: '2026-10-31T08:00:00.000Z',
          },
          {
            month: '2026-09',
            postCount: 1,
            lastModifiedAt: '2026-09-02T10:00:00.000Z',
          },
        ],
      }),
    ).toEqual([
      { loc: 'https://portal.test/sitemaps/static.xml' },
      { loc: 'https://portal.test/sitemaps/news.xml' },
      {
        loc: 'https://portal.test/sitemaps/posts-2026-10.xml',
        lastModified: '2026-10-31T08:00:00.000Z',
      },
      {
        loc: 'https://portal.test/sitemaps/posts-2026-09.xml',
        lastModified: '2026-09-02T10:00:00.000Z',
      },
    ]);
  });

  it('файл місяця: `posts-YYYY-MM.xml` → місяць; інше — `null` (404)', () => {
    expect(sitemapMonthOf('posts-2026-10.xml')).toBe('2026-10');
    for (const fileName of [
      'posts-2026-13.xml',
      'posts-2026-1.xml',
      'posts-0999-10.xml',
      'posts-2026-10.xml.gz',
      'posts-2026-10',
      'static.xml',
      'posts-.xml',
    ]) {
      expect(sitemapMonthOf(fileName)).toBeNull();
    }
  });
});

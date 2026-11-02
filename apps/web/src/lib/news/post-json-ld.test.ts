import { describe, expect, it } from 'vitest';
import { postSitemapUrls } from '@/lib/seo/sitemap-entries';
import { postJsonLd, type PostJsonLdPage } from './post-json-ld';
import { postMetadata } from './post-metadata';

const SITE = 'https://portal.test';
const UNSPLASH_PHOTO =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018';

const POST = {
  number: 12,
  slug: 'arsenal-win-the-derby',
  title: 'Арсенал виграв дербі',
  excerpt: 'Пізній гол вирішив лондонське дербі.',
  coverImageUrl: `${UNSPLASH_PHOTO}?w=1200&h=630&fit=crop&q=80`,
  coverImageAlt: 'Гравці «Арсенала» святкують',
  publishedAt: '2026-10-20T18:30:00.000Z',
  lastModifiedAt: '2026-10-21T08:15:00.000Z',
  author: {
    id: 'u1',
    name: 'Олена Коваль',
    avatarUrl: null,
    isDeleted: false,
  },
  resolvedLanguage: 'uk',
  sourceUrl: 'https://www.bbc.com/sport/football/articles/derby',
  availableLanguages: ['en', 'uk'],
  tags: [],
  competitions: [],
};

const PAGE: PostJsonLdPage = {
  locale: 'uk',
  siteOrigin: SITE,
  siteName: 'Футбольний портал',
  breadcrumbNames: { home: 'Головна', news: 'Новини' },
};

describe('JSON-LD новини (D34, M1.8.4)', () => {
  it('з перекладом і обкладинкою: адреса й мова сторінки, обрізання фото 16:9, 4:3, 1:1, дата зміни — `lastModifiedAt`', () => {
    const { article, breadcrumbs } = postJsonLd(POST, PAGE);
    const pageUrl = `${SITE}/uk/news/arsenal-win-the-derby-12`;

    expect(article).toEqual({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
      url: pageUrl,
      headline: POST.title,
      description: POST.excerpt,
      image: [
        `${UNSPLASH_PHOTO}?w=1200&h=675&fit=crop&q=80`,
        `${UNSPLASH_PHOTO}?w=1200&h=900&fit=crop&q=80`,
        `${UNSPLASH_PHOTO}?w=1200&h=1200&fit=crop&q=80`,
      ],
      datePublished: POST.publishedAt,
      dateModified: POST.lastModifiedAt,
      author: [{ '@type': 'Person', name: 'Олена Коваль' }],
      publisher: {
        '@type': 'Organization',
        name: 'Футбольний портал',
        url: SITE,
      },
      inLanguage: 'uk',
      isBasedOn: POST.sourceUrl,
    });
    expect(breadcrumbs.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Головна',
        item: `${SITE}/uk`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Новини',
        item: `${SITE}/uk/news`,
      },
      { '@type': 'ListItem', position: 3, name: POST.title },
    ]);
  });

  it('без обкладинки й джерела — без `image` і `isBasedOn`; видалений автор — автором видання', () => {
    const { article } = postJsonLd(
      {
        ...POST,
        coverImageUrl: null,
        sourceUrl: null,
        author: { ...POST.author, isDeleted: true },
      },
      PAGE,
    );

    expect(article).not.toHaveProperty('image');
    expect(article).not.toHaveProperty('isBasedOn');
    expect(article).toMatchObject({
      author: [{ '@type': 'Organization', name: 'Футбольний портал' }],
    });
  });

  it('/uk/ без перекладу: стаття — англійська за EN-адресою (як canonical), крихти — мовою сторінки', () => {
    const englishOnly = {
      ...POST,
      title: 'Arsenal win the derby',
      resolvedLanguage: 'en',
      availableLanguages: ['en'],
    };

    const { article, breadcrumbs } = postJsonLd(englishOnly, PAGE);
    const englishUrl = `${SITE}/en/news/arsenal-win-the-derby-12`;

    expect(article).toMatchObject({
      url: englishUrl,
      mainEntityOfPage: { '@type': 'WebPage', '@id': englishUrl },
      inLanguage: 'en',
    });
    expect(breadcrumbs.itemListElement).toMatchObject([
      { item: `${SITE}/uk` },
      { item: `${SITE}/uk/news` },
      { name: 'Arsenal win the derby' },
    ]);
    // Та сама адреса, що й canonical метаданих
    const canonical = postMetadata(englishOnly, {
      locale: 'uk',
      siteName: PAGE.siteName,
      collator: new Intl.Collator('uk-UA'),
    }).alternates?.canonical;
    expect(`${SITE}${String(canonical)}`).toBe(englishUrl);
  });

  it.each([
    ['з перекладом', ['en', 'uk'], 'uk'],
    ['без перекладу', ['en'], 'en'],
  ])(
    '%s: `dateModified`, `article:modified_time` і `lastmod` у sitemap — одна дата за однією адресою (OQ-26)',
    (_case, availableLanguages, contentLanguage) => {
      const post = { ...POST, availableLanguages };
      // Відповідь API sitemap для тієї самої новини: дата адреси — та сама `lastModifiedAt` (e2e `post-last-modified`)
      const sitemapUrls = postSitemapUrls(SITE, {
        posts: [
          {
            number: post.number,
            slug: post.slug,
            translations: availableLanguages.map((languageCode) => ({
              languageCode,
              lastModifiedAt:
                languageCode === contentLanguage
                  ? post.lastModifiedAt
                  : '2026-10-20T18:30:00.000Z',
            })),
          },
        ],
      });

      const { article } = postJsonLd(post, PAGE);
      const metadata = postMetadata(post, {
        locale: 'uk',
        siteName: PAGE.siteName,
        collator: new Intl.Collator('uk-UA'),
      });
      const sitemapUrl = sitemapUrls.find((url) => url.loc === article.url);

      expect(sitemapUrl).toBeDefined();
      expect(article.dateModified).toBe(post.lastModifiedAt);
      expect(metadata.openGraph).toMatchObject({
        modifiedTime: post.lastModifiedAt,
      });
      expect(sitemapUrl?.lastModified).toBe(post.lastModifiedAt);
    },
  );
});

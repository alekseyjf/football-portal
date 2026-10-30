import { describe, expect, it } from 'vitest';
import { pageMetadata, type PageMetadataSource } from './page-metadata';

const NEWS_PAGE: PageMetadataSource = {
  locale: 'uk',
  href: '/news',
  title: 'Новини',
  description: 'Футбольні новини',
  siteName: 'Футбольний портал',
  shareCardHref: '/og/page/news',
};

describe('Метадані сторінки (M1.8.1, D34)', () => {
  it('сторінка обома мовами: canonical — на себе, hreflang — en, uk і x-default → EN', () => {
    const metadata = pageMetadata(NEWS_PAGE);

    expect(metadata.alternates).toEqual({
      canonical: '/uk/news',
      languages: { en: '/en/news', uk: '/uk/news', 'x-default': '/en/news' },
    });
    expect(metadata.robots).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      url: '/uk/news',
      siteName: 'Футбольний портал',
      locale: 'uk_UA',
      alternateLocale: ['en_US'],
      type: 'website',
    });
  });

  it('сторінка без перекладу (/uk з англійським текстом): canonical → EN, у hreflang немає uk, без noindex', () => {
    const metadata = pageMetadata({
      ...NEWS_PAGE,
      href: '/news/arsenal-win-12',
      shareCardHref: '/og/post/12',
      languages: ['en'],
    });

    expect(metadata.alternates).toEqual({
      canonical: '/en/news/arsenal-win-12',
      languages: {
        en: '/en/news/arsenal-win-12',
        'x-default': '/en/news/arsenal-win-12',
      },
    });
    expect(metadata.robots).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      url: '/en/news/arsenal-win-12',
      locale: 'en_US',
      alternateLocale: [],
      images: [expect.objectContaining({ url: '/en/og/post/12' })],
    });
  });

  it('?page=N стрічки — canonical на себе, а не на першу сторінку (D52); hreflang — та сама сторінка іншою мовою', () => {
    const metadata = pageMetadata({ ...NEWS_PAGE, href: '/news?page=3' });

    expect(metadata.alternates).toEqual({
      canonical: '/uk/news?page=3',
      languages: {
        en: '/en/news?page=3',
        uk: '/uk/news?page=3',
        'x-default': '/en/news?page=3',
      },
    });
  });

  it('сторінка не для пошуку: noindex, follow, canonical — на себе, без hreflang', () => {
    const metadata = pageMetadata({
      ...NEWS_PAGE,
      href: { pathname: '/matches', query: { date: '2026-10-30' } },
      isIndexable: false,
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({
      canonical: '/uk/matches?date=2026-10-30',
    });
  });

  it('порожній query (`/matches` без дня й ліги) — адреса без `?` у кінці', () => {
    const metadata = pageMetadata({
      ...NEWS_PAGE,
      href: { pathname: '/matches', query: {} },
    });

    expect(metadata.alternates?.canonical).toBe('/uk/matches');
    expect(metadata.alternates?.languages).toMatchObject({
      en: '/en/matches',
    });
  });

  it('без обкладинки — велика картка X зі згенерованою карткою: назва сторінки в alt, розмір 1200 × 630', () => {
    const metadata = pageMetadata(NEWS_PAGE);

    expect(metadata.twitter).toEqual({ card: 'summary_large_image' });
    expect(metadata.openGraph?.images).toEqual([
      {
        url: '/uk/og/page/news',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Новини',
      },
    ]);
  });

  it('з обкладинкою — вона з описом фото, картка X теж велика', () => {
    const metadata = pageMetadata({
      ...NEWS_PAGE,
      cover: {
        url: 'https://images.example.com/derby.jpg',
        alt: 'Гравці «Арсенала» святкують гол',
      },
    });

    expect(metadata.twitter).toEqual({ card: 'summary_large_image' });
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://images.example.com/derby.jpg',
        alt: 'Гравці «Арсенала» святкують гол',
      },
    ]);
  });

  it('назва — під шаблон сайту, а з `isTitleAbsolute` — без нього (головна)', () => {
    expect(pageMetadata(NEWS_PAGE).title).toBe('Новини');
    expect(
      pageMetadata({ ...NEWS_PAGE, href: '/', isTitleAbsolute: true }).title,
    ).toEqual({ absolute: 'Новини' });
  });
});

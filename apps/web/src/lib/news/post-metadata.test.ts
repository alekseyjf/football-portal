import { describe, expect, it } from 'vitest';
import { postMetadata } from './post-metadata';

const POST = {
  number: 12,
  slug: 'arsenal-win-the-derby',
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  publishedAt: '2026-10-20T18:30:00.000Z',
  coverImageUrl: null,
  coverImageAlt: null,
  availableLanguages: ['en', 'uk'],
  tags: [
    { id: 't1', slug: 'transfers', name: 'Transfers' },
    { id: 't2', slug: 'derby', name: 'Derby' },
  ],
  competitions: [
    { id: 'c1', slug: 'PL', name: 'Premier League', emblemUrl: null },
  ],
};

const PAGE = {
  locale: 'en' as const,
  siteName: 'Football Portal',
  collator: new Intl.Collator('en-GB'),
};

describe('Метадані новини (M1.6.2, M1.8.1)', () => {
  it('з обкладинкою: опис — анонс, прев’ю — стаття з датою, рубрикою й тегами, обкладинка з описом фото', () => {
    const metadata = postMetadata(
      {
        ...POST,
        coverImageUrl: 'https://images.example.com/derby.jpg',
        coverImageAlt: 'Arsenal players celebrate the winning goal',
      },
      PAGE,
    );

    expect(metadata.description).toBe(POST.excerpt);
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      title: POST.title,
      description: POST.excerpt,
      publishedTime: POST.publishedAt,
      modifiedTime: POST.publishedAt,
      section: 'Premier League',
      tags: ['Transfers', 'Derby'],
      images: [
        {
          url: 'https://images.example.com/derby.jpg',
          alt: 'Arsenal players celebrate the winning goal',
        },
      ],
    });
  });

  it('без обкладинки — згенерована картка новини за номером', () => {
    expect(postMetadata(POST, PAGE).openGraph?.images).toEqual([
      expect.objectContaining({ url: '/en/og/post/12', alt: POST.title }),
    ]);
  });

  it('є UK-переклад: на /uk — canonical на себе й обидві мови в hreflang', () => {
    const metadata = postMetadata(POST, { ...PAGE, locale: 'uk' });

    expect(metadata.alternates).toEqual({
      canonical: '/uk/news/arsenal-win-the-derby-12',
      languages: {
        en: '/en/news/arsenal-win-the-derby-12',
        uk: '/uk/news/arsenal-win-the-derby-12',
        'x-default': '/en/news/arsenal-win-the-derby-12',
      },
    });
  });

  it('без UK-перекладу: /uk — canonical на EN, без uk у hreflang, мова прев’ю — англійська', () => {
    const metadata = postMetadata(
      { ...POST, availableLanguages: ['en'] },
      { ...PAGE, locale: 'uk' },
    );

    expect(metadata.alternates).toEqual({
      canonical: '/en/news/arsenal-win-the-derby-12',
      languages: {
        en: '/en/news/arsenal-win-the-derby-12',
        'x-default': '/en/news/arsenal-win-the-derby-12',
      },
    });
    expect(metadata.robots).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({ locale: 'en_US' });
  });

  it('кілька турнірів — рубрика за першим тегом абеткою, як на картці', () => {
    const metadata = postMetadata(
      {
        ...POST,
        competitions: [
          ...POST.competitions,
          { id: 'c2', slug: 'CL', name: 'Champions League', emblemUrl: null },
        ],
      },
      PAGE,
    );

    expect(metadata.openGraph).toMatchObject({ section: 'Derby' });
  });
});

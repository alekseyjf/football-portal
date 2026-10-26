import { describe, expect, it } from 'vitest';
import { postMetadata } from './post-metadata';

const POST = {
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  publishedAt: '2026-10-20T18:30:00.000Z',
  coverImageUrl: null,
  coverImageAlt: null,
};

describe('Метадані новини (M1.6.2)', () => {
  it('з обкладинкою: опис — анонс, прев’ю — заголовок, анонс і обкладинка з описом фото', () => {
    const metadata = postMetadata({
      ...POST,
      coverImageUrl: 'https://images.example.com/derby.jpg',
      coverImageAlt: 'Arsenal players celebrate the winning goal',
    });

    expect(metadata.description).toBe(POST.excerpt);
    expect(metadata.openGraph).toMatchObject({
      title: POST.title,
      description: POST.excerpt,
      publishedTime: POST.publishedAt,
      images: [
        {
          url: 'https://images.example.com/derby.jpg',
          alt: 'Arsenal players celebrate the winning goal',
        },
      ],
    });
  });

  it('без обкладинки — прев’ю без картинки', () => {
    expect(postMetadata(POST).openGraph?.images).toBeUndefined();
  });
});

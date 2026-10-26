import { describe, expect, it } from 'vitest';
import {
  breadcrumbListJsonLd,
  newsArticleJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  webSiteJsonLd,
} from './json-ld';

describe('JSON-LD (D34)', () => {
  it('хлібні крихти: позиції з 1, у поточної сторінки — без адреси', () => {
    expect(
      breadcrumbListJsonLd([
        { name: 'Головна', url: 'https://example.com/uk' },
        { name: 'Новини', url: 'https://example.com/uk/news' },
        { name: 'Арсенал виграв дербі' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: 'https://example.com/uk' },
        { '@type': 'ListItem', position: 2, name: 'Новини', item: 'https://example.com/uk/news' },
        { '@type': 'ListItem', position: 3, name: 'Арсенал виграв дербі' },
      ],
    });
  });

  it('NewsArticle: заголовок, опис, фото, дати (змінено = опубліковано), автор, видання, мова, джерело', () => {
    const article = {
      url: 'https://example.com/uk/news/derby-12',
      headline: 'Арсенал виграв дербі',
      description: 'Пізній гол вирішив дербі.',
      imageUrl: 'https://images.example.com/derby.jpg',
      datePublished: '2026-10-20T18:30:00.000Z',
      authorName: 'Олена Коваль',
      publisher: { name: 'Футбольний портал', url: 'https://example.com' },
      inLanguage: 'uk',
      sourceUrl: 'https://www.bbc.com/sport/football/articles/derby',
    };
    const publisher = { '@type': 'Organization', name: 'Футбольний портал', url: 'https://example.com' };

    expect(newsArticleJsonLd(article)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
      url: article.url,
      headline: article.headline,
      description: article.description,
      image: [article.imageUrl],
      datePublished: article.datePublished,
      dateModified: article.datePublished,
      author: [{ '@type': 'Person', name: 'Олена Коваль' }],
      publisher,
      inLanguage: 'uk',
      isBasedOn: article.sourceUrl,
    });

    // Без фото й джерела — без цих полів; видалений автор — автором видання
    const bare = newsArticleJsonLd({ ...article, imageUrl: null, sourceUrl: null, authorName: null });
    expect(bare).not.toHaveProperty('image');
    expect(bare).not.toHaveProperty('isBasedOn');
    expect(bare.author).toEqual([publisher]);
  });

  it('головна (D55): WebSite — назва, адреса головної мовою сторінки й видання; Organization — те саме видання', () => {
    const publisher = { name: 'Футбольний портал', url: 'https://example.com' };

    expect(
      webSiteJsonLd({ name: 'Футбольний портал', url: 'https://example.com/uk', inLanguage: 'uk', publisher }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Футбольний портал',
      url: 'https://example.com/uk',
      inLanguage: 'uk',
      publisher: { '@type': 'Organization', name: 'Футбольний портал', url: 'https://example.com' },
    });
    expect(organizationJsonLd(publisher)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Футбольний портал',
      url: 'https://example.com',
    });
  });

  it('текст з `</script>` і `<!--` не закриває тег: жодного `<`, а JSON — той самий', () => {
    const data = { name: 'Title </script><script>alert(1)</script> <!-- & "quotes"' };

    const serialized = serializeJsonLd(data);

    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual(data);
  });
});

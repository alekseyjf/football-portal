import { describe, expect, it } from 'vitest';
import { postTopicLinks } from './post-topics';

const ukrainianCollator = new Intl.Collator('uk-UA');

function competition(slug: string, name: string) {
  return { id: `competition-${slug}`, slug, name, emblemUrl: null };
}

function club(slug: string, name: string) {
  return { id: `club-${slug}`, slug, name, shortName: null, crestUrl: null };
}

function tag(slug: string, name: string) {
  return { id: `tag-${slug}`, slug, name };
}

describe('Теми новини внизу статті (M1.6.2)', () => {
  it('турніри в порядку редакції, далі клуби, далі теги за абеткою мови сторінки', () => {
    const topics = postTopicLinks(
      {
        competitions: [
          competition('PL', 'Premier League'),
          competition('CL', 'UEFA Champions League'),
        ],
        clubs: [club('arsenal-fc', 'Arsenal FC'), club('chelsea-fc', 'Chelsea FC')],
        // За slug-ом чи кодами Unicode «Ґ» і «І» стали б не на свої місця
        tags: [tag('injuries', 'Травми'), tag('ivory', 'Інтерв’ю'), tag('goal', 'Ґол'), tag('hat', 'Гол')],
      },
      ukrainianCollator,
    );

    expect(topics.map((topic) => topic.name)).toEqual([
      'Premier League',
      'UEFA Champions League',
      'Arsenal FC',
      'Chelsea FC',
      'Гол',
      'Ґол',
      'Інтерв’ю',
      'Травми',
    ]);
  });

  it('кожна тема веде у стрічку лише зі своїм фільтром — тими самими параметрами, що й чипи стрічки', () => {
    const topics = postTopicLinks(
      {
        competitions: [competition('PL', 'Premier League')],
        clubs: [club('arsenal-fc', 'Arsenal FC')],
        tags: [tag('transfers', 'Трансфери')],
      },
      ukrainianCollator,
    );

    expect(topics).toEqual([
      { key: 'competition:PL', name: 'Premier League', href: '/news?competition=PL' },
      { key: 'club:arsenal-fc', name: 'Arsenal FC', href: '/news?club=arsenal-fc' },
      { key: 'tag:transfers', name: 'Трансфери', href: '/news?tags=transfers' },
    ]);
  });

  it('без зв’язків — без тем; теги новини не переставляє', () => {
    const tags = [tag('transfers', 'Трансфери'), tag('analysis', 'Аналітика')];

    expect(postTopicLinks({ competitions: [], clubs: [], tags: [] }, ukrainianCollator)).toEqual([]);
    postTopicLinks({ competitions: [], clubs: [], tags }, ukrainianCollator);
    expect(tags.map((topic) => topic.slug)).toEqual(['transfers', 'analysis']);
  });
});

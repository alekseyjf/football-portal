import {
  CLUB_SLUG_MAX_LENGTH,
  PAGE_NUMBER_MAX,
  POSTS_FILTER_VALUES_MAX,
  TAG_SLUG_MAX_LENGTH,
} from '@football-portal/validation';
import { describe, expect, it } from 'vitest';
import {
  NO_NEWS_FEED_FILTERS,
  newsFeedApiPath,
  newsFeedHref,
  newsFeedHrefWithPage,
  newsFeedSearchPage,
  parseNewsFeedFilters,
  resolveNewsFeedPage,
  withoutClub,
  withoutTag,
  type NewsFeedFilters,
} from './news-feed-filters';

function slugList(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `tag-${index}`);
}

describe('Фільтри стрічки `/news` з адреси (D46)', () => {
  it('теги й клуби — через кому, ліга — одна', () => {
    expect(
      parseNewsFeedFilters({
        tags: 'transfers,injuries',
        competition: 'PL',
        club: 'arsenal,chelsea',
      }),
    ).toEqual({
      tags: ['transfers', 'injuries'],
      competition: 'PL',
      clubs: ['arsenal', 'chelsea'],
    });
    expect(parseNewsFeedFilters({})).toEqual(NO_NEWS_FEED_FILTERS);
  });

  it('порожні значення й пробіли довкола — без них, а не 400, як в API', () => {
    expect(
      parseNewsFeedFilters({ tags: '', competition: '', club: ',' }),
    ).toEqual(NO_NEWS_FEED_FILTERS);
    expect(
      parseNewsFeedFilters({ tags: 'transfers,, injuries ,' }).tags,
    ).toEqual(['transfers', 'injuries']);
  });

  it('значення не того формату — без них: решта фільтра працює', () => {
    expect(
      parseNewsFeedFilters({
        tags: `Transfers,transfer_window,${'x'.repeat(TAG_SLUG_MAX_LENGTH + 1)},injuries`,
        club: `arsenal_fc,${'x'.repeat(CLUB_SLUG_MAX_LENGTH + 1)},chelsea`,
      }),
    ).toEqual({ tags: ['injuries'], competition: null, clubs: ['chelsea'] });
    // Межі формату — включно
    const longestTag = 'x'.repeat(TAG_SLUG_MAX_LENGTH);
    const longestClub = 'x'.repeat(CLUB_SLUG_MAX_LENGTH);
    expect(
      parseNewsFeedFilters({ tags: longestTag, club: longestClub }),
    ).toMatchObject({
      tags: [longestTag],
      clubs: [longestClub],
    });
  });

  it('невідомий slug правильного формату лишається — API дасть порожню сторінку', () => {
    expect(
      parseNewsFeedFilters({ tags: 'no-such-tag', competition: 'XX' }),
    ).toEqual({
      tags: ['no-such-tag'],
      competition: 'XX',
      clubs: [],
    });
  });

  it('повтори — один раз, у порядку першої появи', () => {
    expect(
      parseNewsFeedFilters({ tags: 'injuries,transfers,injuries' }).tags,
    ).toEqual(['injuries', 'transfers']);
  });

  it(`до ${POSTS_FILTER_VALUES_MAX} значень у фільтрі — далі відкидаються`, () => {
    const slugs = slugList(POSTS_FILTER_VALUES_MAX + 1);
    expect(parseNewsFeedFilters({ tags: slugs.join(',') }).tags).toEqual(
      slugs.slice(0, POSTS_FILTER_VALUES_MAX),
    );
    // Відкинуті значення місця не займають
    expect(
      parseNewsFeedFilters({
        tags: ['Bad', ...slugList(POSTS_FILTER_VALUES_MAX)].join(','),
      }).tags,
    ).toHaveLength(POSTS_FILTER_VALUES_MAX);
  });

  it('ліга — перша правильна з кількох; формат — код турніру', () => {
    expect(parseNewsFeedFilters({ competition: 'PL,CL' }).competition).toBe(
      'PL',
    );
    expect(parseNewsFeedFilters({ competition: 'P L,CL' }).competition).toBe(
      'CL',
    );
    expect(
      parseNewsFeedFilters({ competition: 'PL;CL' }).competition,
    ).toBeNull();
  });

  it('повтор параметра — перше значення, як `URLSearchParams.get` у браузері', () => {
    expect(
      parseNewsFeedFilters({
        tags: ['transfers', 'injuries'],
        competition: ['CL', 'PL'],
      }),
    ).toEqual({ tags: ['transfers'], competition: 'CL', clubs: [] });
  });
});

describe('Сторінка стрічки `?page=` (D38, D52): одна сторінка — одна адреса', () => {
  it.each([
    [undefined, 1],
    ['2', 2],
    [String(PAGE_NUMBER_MAX), PAGE_NUMBER_MAX],
  ])('%j — канонічна, сторінка %d', (value, page) => {
    expect(resolveNewsFeedPage(value)).toEqual({ kind: 'page', page });
  });

  it.each<[string | string[], number]>([
    // Перша сторінка — без параметра
    ['1', 1],
    // Інший запис тієї самої сторінки
    ['02', 2],
    [' 3 ', 3],
    [['4', '5'], 4],
    // Невалідне — перша, а не порожня сторінка зі статусом 200
    ['', 1],
    ['0', 1],
    ['-1', 1],
    ['abc', 1],
    ['2.5', 1],
    ['1e3', 1],
  ])('%j — переадресація на сторінку %d', (value, page) => {
    expect(resolveNewsFeedPage(value)).toEqual({ kind: 'redirect', page });
  });

  it.each([String(PAGE_NUMBER_MAX + 1), '99999999999999999999'])(
    '%j — понад межу API: такої сторінки немає (404)',
    (value) => {
      expect(resolveNewsFeedPage(value)).toEqual({ kind: 'notFound' });
    },
  );

  it('адреса переадресації — ті самі параметри в тому ж порядку, і чужі; `page` — останнім, перша — без нього', () => {
    const searchParams = {
      utm_source: 'news letter',
      tags: 'transfers,Bad',
      page: 'abc',
      club: ['arsenal', 'chelsea'],
    };
    expect(newsFeedHrefWithPage(searchParams, 1)).toBe(
      '/news?utm_source=news%20letter&tags=transfers,Bad&club=arsenal&club=chelsea',
    );
    expect(newsFeedHrefWithPage({ page: '02' }, 2)).toBe('/news?page=2');
    expect(newsFeedHrefWithPage({ page: '1' }, 1)).toBe('/news');
  });
});

describe('Адреса стрічки з фільтрів', () => {
  const filters: NewsFeedFilters = {
    tags: ['transfers', 'injuries'],
    competition: 'PL',
    clubs: ['arsenal'],
  };

  it('фільтри — в одному порядку, кома — як є; сторінка 1 — без `page`', () => {
    expect(newsFeedHref(filters)).toBe(
      '/news?tags=transfers,injuries&competition=PL&club=arsenal',
    );
    expect(newsFeedHref(filters, 3)).toBe(
      '/news?tags=transfers,injuries&competition=PL&club=arsenal&page=3',
    );
    expect(newsFeedHref(NO_NEWS_FEED_FILTERS)).toBe('/news');
    expect(newsFeedHref(NO_NEWS_FEED_FILTERS, 2)).toBe('/news?page=2');
  });

  it('розбір адреси повертає ті самі фільтри й сторінку', () => {
    const searchParams = Object.fromEntries(
      new URL(newsFeedHref(filters, 5), 'https://12yards.test').searchParams,
    );
    expect(parseNewsFeedFilters(searchParams)).toEqual(filters);
    expect(resolveNewsFeedPage(searchParams.page)).toEqual({
      kind: 'page',
      page: 5,
    });
  });

  it('чип прибирає лише своє значення, решта фільтрів лишається', () => {
    expect(newsFeedHref(withoutTag(filters, 'transfers'))).toBe(
      '/news?tags=injuries&competition=PL&club=arsenal',
    );
    expect(newsFeedHref(withoutClub(filters, 'arsenal'))).toBe(
      '/news?tags=transfers,injuries&competition=PL',
    );
  });

  it('запит до API — ті самі фільтри, сторінка, розмір і мова', () => {
    const apiUrl = new URL(
      newsFeedApiPath(filters, { page: 2, limit: 12, lang: 'uk' }),
      'https://api.test',
    );
    expect(apiUrl.pathname).toBe('/posts');
    expect(Object.fromEntries(apiUrl.searchParams)).toEqual({
      page: '2',
      limit: '12',
      lang: 'uk',
      tags: 'transfers,injuries',
      competition: 'PL',
      club: 'arsenal',
    });
  });
});

describe('Стрічка для пошуку (M1.8.1, D52)', () => {
  it('`utm_*` і чужі параметри — не в canonical: стрічка без фільтрів лишається в індексі', () => {
    expect(
      newsFeedSearchPage(
        { utm_source: 'telegram', utm_campaign: 'derby', fbclid: 'x' },
        1,
      ),
    ).toEqual({ href: '/news', isIndexable: true });
  });

  it('`?page=N` без фільтрів — в індексі, canonical на себе (з `utm_*` — без них)', () => {
    expect(
      newsFeedSearchPage({ page: '3', utm_source: 'telegram' }, 3),
    ).toEqual({
      href: '/news?page=3',
      isIndexable: true,
    });
  });

  it('будь-який фільтр — `noindex`, canonical на себе: фільтри в сталому порядку, без `utm_*`', () => {
    expect(
      newsFeedSearchPage(
        {
          utm_medium: 'social',
          club: 'arsenal',
          competition: 'PL',
          tags: 'transfers',
        },
        2,
      ),
    ).toEqual({
      href: '/news?tags=transfers&competition=PL&club=arsenal&page=2',
      isIndexable: false,
    });
    expect(newsFeedSearchPage({ competition: 'PL' }, 1)).toEqual({
      href: '/news?competition=PL',
      isIndexable: false,
    });
  });

  it('фільтр не того формату відкинуто — це стрічка без фільтрів, вона в індексі', () => {
    expect(newsFeedSearchPage({ club: 'Arsenal FC', tags: '' }, 1)).toEqual({
      href: '/news',
      isIndexable: true,
    });
  });
});

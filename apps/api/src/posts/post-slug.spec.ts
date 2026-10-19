import {
  POST_SLUG_PATTERN,
  resolveUpdatedPostSlug,
  slugifyTitle,
  type PostSlugUpdateInput,
} from './post-slug';

describe('slugifyTitle', () => {
  it.each([
    ['Mbappé scores twice!', 'mbappe-scores-twice'],
    ['  Arsenal   vs.  Chelsea — 2:1  ', 'arsenal-vs-chelsea-2-1'],
    ['Ødegaard & Saka', 'odegaard-saka'],
    ['Łukasz Fabiański, Højlund, Straße', 'lukasz-fabianski-hojlund-strasse'],
    ['Müller über alles', 'muller-uber-alles'],
    ['--Already-Slugged--', 'already-slugged'],
  ])('%j → %j', (title, slug) => {
    expect(slugifyTitle(title)).toBe(slug);
  });

  it('без латиниці (лише кирилиця / символи) — fallback `post`', () => {
    expect(slugifyTitle('Новини дня')).toBe('post');
    expect(slugifyTitle('!!! ???')).toBe('post');
  });

  it('обрізає до 80 символів по межі слова', () => {
    const title = Array.from({ length: 30 }, () => 'football').join(' ');
    const slug = slugifyTitle(title);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('football')).toBe(true);
    expect(slug).not.toMatch(/-$/);
  });

  it('одне слово довше за ліміт — ріже саме слово', () => {
    expect(slugifyTitle('a'.repeat(120))).toBe('a'.repeat(80));
  });

  it('результат проходить ту саму перевірку, що й явний slug з адмінки', () => {
    for (const title of ['Mbappé — 2:1!', 'Новини дня', 'x'.repeat(120)]) {
      expect(slugifyTitle(title)).toMatch(POST_SLUG_PATTERN);
    }
  });
});

describe('resolveUpdatedPostSlug (D24)', () => {
  const draft: PostSlugUpdateInput['current'] = {
    slug: 'arsenal-win',
    publishedAt: null,
    defaultTitle: 'Arsenal win',
  };
  const published: PostSlugUpdateInput['current'] = {
    ...draft,
    publishedAt: new Date('2026-10-18T09:00:00Z'),
  };

  it('без дати публікації slug іде за новим EN-заголовком', () => {
    expect(
      resolveUpdatedPostSlug({
        current: draft,
        requestedDefaultTitle: 'Arsenal beat Chelsea',
      }),
    ).toBe('arsenal-beat-chelsea');
  });

  it('з датою публікації (PUBLISHED, SCHEDULED) новий заголовок slug не змінює', () => {
    expect(
      resolveUpdatedPostSlug({
        current: published,
        requestedDefaultTitle: 'Arsenal beat Chelsea',
      }),
    ).toBeUndefined();
  });

  it('явний slug з адмінки змінює й опубліковану новину', () => {
    expect(
      resolveUpdatedPostSlug({
        current: published,
        requestedSlug: 'north-london-derby',
        requestedDefaultTitle: 'Arsenal beat Chelsea',
      }),
    ).toBe('north-london-derby');
  });

  it('збереження чернетки без зміни заголовка не скидає явний slug', () => {
    expect(
      resolveUpdatedPostSlug({
        current: { ...draft, slug: 'north-london-derby' },
        requestedDefaultTitle: draft.defaultTitle,
      }),
    ).toBeUndefined();
  });

  it('запит без EN-перекладу slug чернетки не змінює', () => {
    expect(resolveUpdatedPostSlug({ current: draft })).toBeUndefined();
  });
});

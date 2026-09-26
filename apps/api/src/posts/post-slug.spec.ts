import { slugifyTitle, withRandomSlugSuffix } from './post-slug';

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
});

describe('withRandomSlugSuffix', () => {
  it('додає 6 hex-символів', () => {
    expect(withRandomSlugSuffix('mbappe-scores')).toMatch(
      /^mbappe-scores-[0-9a-f]{6}$/,
    );
  });

  it('суфікси різні', () => {
    const slugs = new Set(
      Array.from({ length: 50 }, () => withRandomSlugSuffix('post')),
    );
    expect(slugs.size).toBe(50);
  });
});

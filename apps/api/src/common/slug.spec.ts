import { SLUG_PATTERN, slugify } from './slug';

const MAX_LENGTH = 80;

describe('slugify', () => {
  it.each([
    ['Mbappé scores twice!', 'mbappe-scores-twice'],
    ['  Arsenal   vs.  Chelsea — 2:1  ', 'arsenal-vs-chelsea-2-1'],
    ['Ødegaard & Saka', 'odegaard-saka'],
    ['Łukasz Fabiański, Højlund, Straße', 'lukasz-fabianski-hojlund-strasse'],
    ['Müller über alles', 'muller-uber-alles'],
    ['--Already-Slugged--', 'already-slugged'],
  ])('%j → %j', (text, slug) => {
    expect(slugify(text, MAX_LENGTH)).toBe(slug);
  });

  it('без латиниці й цифр (лише кирилиця / символи) — null: що робити, вирішує правило новини чи тегу', () => {
    expect(slugify('Новини дня', MAX_LENGTH)).toBeNull();
    expect(slugify('!!! ???', MAX_LENGTH)).toBeNull();
  });

  it('обрізає до ліміту по межі слова', () => {
    const text = Array.from({ length: 30 }, () => 'football').join(' ');
    const slug = slugify(text, MAX_LENGTH) ?? '';
    expect(slug.length).toBeLessThanOrEqual(MAX_LENGTH);
    expect(slug.endsWith('football')).toBe(true);
    expect(slug).not.toMatch(/-$/);
  });

  it('одне слово довше за ліміт — ріже саме слово', () => {
    expect(slugify('a'.repeat(120), MAX_LENGTH)).toBe('a'.repeat(MAX_LENGTH));
  });

  it('результат проходить ту саму перевірку, що й явний slug з адмінки', () => {
    for (const text of ['Mbappé — 2:1!', 'Ødegaard & Saka', 'x'.repeat(120)]) {
      expect(slugify(text, MAX_LENGTH)).toMatch(SLUG_PATTERN);
    }
  });
});

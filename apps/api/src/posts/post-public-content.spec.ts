import type { UpdatePostData } from './admin-post.repository';
import {
  changesPublicContent,
  type PostPublicState,
} from './post-public-content';

const EN = {
  languageCode: 'en',
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  content: 'The hosts scored in stoppage time.',
  coverImageAlt: 'Arsenal players celebrate',
};

const SAVED: PostPublicState = {
  slug: 'arsenal-win-the-derby',
  coverImageUrl: 'https://e2e.test/cover.jpg',
  coverImageCredit: 'Getty Images',
  videoUrl: null,
  sourceUrl: null,
  sourceName: null,
  translations: [EN],
  tags: [{ tagId: 'tag-1' }, { tagId: 'tag-2' }],
  clubs: [{ clubId: 'club-1' }],
  competitions: [],
};

function changes(update: UpdatePostData): boolean {
  return changesPublicContent(SAVED, update);
}

describe('changesPublicContent — запис змінює те, що бачить читач (post.updated, D57)', () => {
  it('нічого не передано чи передано те саме — не зміна (і теги в іншому порядку)', () => {
    expect(changes({})).toBe(false);
    expect(
      changes({
        slug: SAVED.slug,
        coverImageUrl: SAVED.coverImageUrl,
        coverImageCredit: SAVED.coverImageCredit,
        videoUrl: null,
        translations: [{ ...EN }],
        tagIds: ['tag-2', 'tag-1'],
        clubIds: ['club-1'],
        competitionIds: [],
      }),
    ).toBe(false);
  });

  it.each<[string, UpdatePostData]>([
    ['новий slug (адреса — 308 зі старої)', { slug: 'derby-report' }],
    ['інше фото обкладинки', { coverImageUrl: 'https://e2e.test/new.jpg' }],
    ['фото прибрали', { coverImageUrl: null }],
    ['підпис фото', { coverImageCredit: 'Reuters' }],
    ['відео', { videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
    ['джерело', { sourceUrl: 'https://e2e.test/source' }],
    ['заголовок', { translations: [{ ...EN, title: 'Arsenal edge Chelsea' }] }],
    ['текст', { translations: [{ ...EN, content: 'Corrected text.' }] }],
    ['опис фото', { translations: [{ ...EN, coverImageAlt: 'Fans' }] }],
    [
      'новий переклад',
      {
        translations: [
          { ...EN, languageCode: 'uk', title: 'Арсенал виграв дербі' },
        ],
      },
    ],
    ['тег прибрали', { tagIds: ['tag-1'] }],
    ['тег замінили', { tagIds: ['tag-1', 'tag-3'] }],
    ['турнір додали', { competitionIds: ['PL'] }],
  ])('%s — зміна', (_case, update) => {
    expect(changes(update)).toBe(true);
  });

  it('опис фото не передано (`undefined`) — лишається як є, не зміна', () => {
    const { languageCode, title, excerpt, content } = EN;
    expect(
      changes({ translations: [{ languageCode, title, excerpt, content }] }),
    ).toBe(false);
  });
});

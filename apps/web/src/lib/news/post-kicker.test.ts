import { describe, expect, it } from 'vitest';
import type { PostSummary } from '@/lib/api/types';
import { postKicker } from './post-kicker';

type KickerSource = Pick<PostSummary, 'competitions' | 'tags'>;

const PREMIER_LEAGUE = {
  id: 'competition-pl',
  slug: 'PL',
  name: 'Premier League',
  emblemUrl: null,
};
const CHAMPIONS_LEAGUE = {
  id: 'competition-cl',
  slug: 'CL',
  name: 'UEFA Champions League',
  emblemUrl: null,
};

function tag(slug: string, name: string) {
  return { id: `tag-${slug}`, slug, name };
}

const ukrainianCollator = new Intl.Collator('uk-UA');

function kickerOf(post: Partial<KickerSource>) {
  return postKicker(
    { competitions: [], tags: [], ...post },
    ukrainianCollator,
  );
}

describe('Рубрика картки новини (M1.6.1)', () => {
  it('один турнір — рубрика турніру, хоч теги теж є; посилання — стрічка лише з ним', () => {
    expect(
      kickerOf({
        competitions: [PREMIER_LEAGUE],
        tags: [tag('transfers', 'Трансфери')],
      }),
    ).toEqual({
      name: 'Premier League',
      filters: { tags: [], competition: 'PL', clubs: [] },
    });
  });

  it('кілька турнірів — перший тег за назвою мовою сторінки, а не за slug-ом', () => {
    expect(
      kickerOf({
        competitions: [PREMIER_LEAGUE, CHAMPIONS_LEAGUE],
        // За slug-ом першим був би «a-transfers»
        tags: [tag('a-transfers', 'Трансфери'), tag('z-injuries', 'Травми')],
      }),
    ).toEqual({
      name: 'Травми',
      filters: { tags: ['z-injuries'], competition: null, clubs: [] },
    });
  });

  it('абетка мови, а не порядок кодів Unicode: «Ґ» і «І» — на своїх місцях', () => {
    // У Unicode «І» (U+0406) іде перед «Г» (U+0413), а «Ґ» (U+0490) — після «Я»
    expect(
      kickerOf({ tags: [tag('games', 'Ігри'), tag('goals', 'Ґолкіпери')] })
        ?.name,
    ).toBe('Ґолкіпери');
    expect(
      kickerOf({ tags: [tag('games', 'Ігри'), tag('play', 'Гра')] })?.name,
    ).toBe('Гра');
  });

  it('без турніру — перший тег; без турнірів і тегів або кілька турнірів без тегів — без рубрики', () => {
    expect(kickerOf({ tags: [tag('injuries', 'Injuries')] })?.name).toBe(
      'Injuries',
    );
    expect(kickerOf({})).toBeNull();
    expect(
      kickerOf({ competitions: [PREMIER_LEAGUE, CHAMPIONS_LEAGUE] }),
    ).toBeNull();
  });

  it('теги новини не переставляє', () => {
    const tags = [tag('b', 'Б'), tag('a', 'А')];
    kickerOf({ tags });
    expect(tags.map((postTag) => postTag.slug)).toEqual(['b', 'a']);
  });
});

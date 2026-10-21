import { POST_SLUG_MAX_LENGTH } from '@football-portal/validation';
import { SLUG_PATTERN } from '../common/slug';
import {
  resolveUpdatedPostSlug,
  slugifyTitle,
  type PostSlugUpdateInput,
} from './post-slug';

describe('slugifyTitle (D24)', () => {
  it('slug з EN-заголовка — до 80 символів', () => {
    expect(slugifyTitle('Mbappé scores twice!')).toBe('mbappe-scores-twice');
    expect(slugifyTitle('a'.repeat(120))).toHaveLength(POST_SLUG_MAX_LENGTH);
  });

  it('без латиниці (лише кирилиця / символи) — fallback `post`: новину визначає номер', () => {
    expect(slugifyTitle('Новини дня')).toBe('post');
    expect(slugifyTitle('!!! ???')).toBe('post');
    expect(slugifyTitle('Новини дня')).toMatch(SLUG_PATTERN);
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

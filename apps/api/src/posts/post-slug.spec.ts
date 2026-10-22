import { resolveUpdatedPostSlug, type PostSlugUpdateInput } from './post-slug';

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

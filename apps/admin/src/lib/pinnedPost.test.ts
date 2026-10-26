import { describe, expect, it } from 'vitest';
import type { AdminPost } from '@/lib/api/types';
import {
  pinnedAfterChange,
  pinnedByText,
  pinStepFor,
  timeAgo,
  withCurrentPinned,
  withPinChange,
} from './pinnedPost';

const NOW = new Date('2026-10-26T12:00:00.000Z');
const PINNED_AT = '2026-10-24T09:30:00.000Z';
const EDITOR = { id: 'editor-1', name: 'Olena Editor', avatarUrl: null, isDeleted: false };

function post(id: string, pin: Partial<Pick<AdminPost, 'pinnedAt' | 'pinnedBy'>> = {}): AdminPost {
  return {
    id,
    number: 1,
    slug: id,
    status: 'PUBLISHED',
    publishedAt: '2026-10-20T10:00:00.000Z',
    isLive: true,
    pinnedAt: null,
    pinnedBy: null,
    coverImageUrl: null,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    author: EDITOR,
    translations: [{ languageCode: 'en', title: `News ${id}` }],
    ...pin,
  };
}

const pinned = (id: string) => post(id, { pinnedAt: PINNED_AT, pinnedBy: EDITOR });

describe('бейдж закріпленої — «Pinned by … · N ago»', () => {
  it.each([
    ['2026-10-24T09:30:00.000Z', '2 days ago'],
    ['2026-10-25T11:00:00.000Z', '1 day ago'],
    ['2026-10-26T09:00:00.000Z', '3 hours ago'],
    ['2026-10-26T11:55:00.000Z', '5 minutes ago'],
    ['2026-10-26T11:59:30.000Z', 'just now'],
    ['2026-10-05T12:00:00.000Z', '3 weeks ago'],
    ['2026-08-20T12:00:00.000Z', '2 months ago'],
  ])('закріплена %s → %s', (pinnedAt, expected) => {
    expect(timeAgo(pinnedAt, NOW)).toBe(expected);
  });

  it('хто закріпив: ім’я; анонімізований — «Deleted user»; рядок видалено фізично — без імені; не закріплена — нічого', () => {
    expect(pinnedByText({ pinnedAt: PINNED_AT, pinnedBy: EDITOR })).toBe('Pinned by Olena Editor');
    expect(
      pinnedByText({ pinnedAt: PINNED_AT, pinnedBy: { ...EDITOR, name: 'Deleted user', isDeleted: true } }),
    ).toBe('Pinned by Deleted user');
    expect(pinnedByText({ pinnedAt: PINNED_AT, pinnedBy: null })).toBe('Pinned');
    expect(pinnedByText({ pinnedAt: null, pinnedBy: null })).toBeNull();
  });
});

describe('pinStepFor — коли питати про заміну', () => {
  it('закріпленої немає — закріпити одразу, без питання', () => {
    expect(pinStepFor('post-a', null)).toEqual({ kind: 'pin', replacesPostId: null });
  });

  it('закріплена інша — спершу спитати, замінить саме її', () => {
    const current = pinned('post-b');
    expect(pinStepFor('post-a', current)).toEqual({ kind: 'confirmReplace', current });
  });

  it('закріплена — вона сама (закріпив хтось інший, поки рядок не оновився) — без питання', () => {
    expect(pinStepFor('post-a', pinned('post-a'))).toEqual({ kind: 'pin', replacesPostId: 'post-a' });
  });
});

describe('кеш після відповіді API — закріплена на сайт одна', () => {
  it('закріпили — у неї хто й коли з відповіді, попередня вже не закріплена, решта без змін', () => {
    const previous = pinned('post-b');
    const other = post('post-c');
    const changed = post('post-a', { pinnedAt: '2026-10-26T11:00:00.000Z', pinnedBy: EDITOR });

    expect(withPinChange(post('post-a'), changed)).toMatchObject({
      pinnedAt: changed.pinnedAt,
      pinnedBy: EDITOR,
    });
    expect(withPinChange(previous, changed)).toMatchObject({ pinnedAt: null, pinnedBy: null });
    expect(withPinChange(other, changed)).toBe(other);
    expect(pinnedAfterChange({ post: previous }, changed)).toEqual({ post: changed });
  });

  it('свіжа закріплена з API (закріпили з іншої вкладки) — у кеші закріплена лише вона; жодної — жодна', () => {
    const stale = pinned('post-b');
    const current = pinned('post-c');
    expect(withCurrentPinned(stale, current)).toMatchObject({ pinnedAt: null, pinnedBy: null });
    expect(withCurrentPinned(post('post-c'), current)).toMatchObject({ pinnedAt: PINNED_AT, pinnedBy: EDITOR });
    expect(withCurrentPinned(stale, null)).toMatchObject({ pinnedAt: null, pinnedBy: null });
  });

  it('відкріпили — лише вона; закріплена жодна, якщо відкріпили саме закріплену', () => {
    const unpinned = post('post-b');
    const stillPinned = pinned('post-c');

    expect(withPinChange(pinned('post-b'), unpinned)).toMatchObject({ pinnedAt: null, pinnedBy: null });
    expect(withPinChange(stillPinned, unpinned)).toBe(stillPinned);
    expect(pinnedAfterChange({ post: pinned('post-b') }, unpinned)).toEqual({ post: null });
    expect(pinnedAfterChange({ post: stillPinned }, unpinned)).toEqual({ post: stillPinned });
  });
});

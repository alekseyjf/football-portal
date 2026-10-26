import { PostStatus } from '@prisma/client';
import {
  decidePin,
  pickHomePosts,
  unpinsOnPublicationChange,
  type PinRequest,
  type PinTarget,
} from './post-pin';
import type { PostPublication } from './post-publication';

const NOW = new Date('2026-10-26T12:00:00.000Z');
const PAST = new Date('2026-10-20T08:00:00.000Z');
const FUTURE = new Date('2026-11-01T10:00:00.000Z');

const LATEST_COUNT = 6;

/** Найсвіжіші першими: `post-1` — найсвіжіша. */
function freshestPosts(count: number): { id: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `post-${index + 1}`,
  }));
}

function ids(posts: { id: string }[]): string[] {
  return posts.map((post) => post.id);
}

describe('pickHomePosts — головна й шість під нею', () => {
  it('закріпленої немає — головна найсвіжіша, під нею шість наступних', () => {
    const selection = pickHomePosts(null, freshestPosts(7), LATEST_COUNT);
    expect(selection.lead).toEqual({ id: 'post-1' });
    expect(ids(selection.latest)).toEqual([
      'post-2',
      'post-3',
      'post-4',
      'post-5',
      'post-6',
      'post-7',
    ]);
  });

  it('закріплена серед найсвіжіших — головна вона, під нею шість інших без дубля', () => {
    const selection = pickHomePosts(
      { id: 'post-3' },
      freshestPosts(7),
      LATEST_COUNT,
    );
    expect(selection.lead).toEqual({ id: 'post-3' });
    expect(ids(selection.latest)).toEqual([
      'post-1',
      'post-2',
      'post-4',
      'post-5',
      'post-6',
      'post-7',
    ]);
  });

  it('закріпленої немає серед семи найсвіжіших — головна вона, під нею шість найсвіжіших', () => {
    const selection = pickHomePosts(
      { id: 'old-pinned' },
      freshestPosts(7),
      LATEST_COUNT,
    );
    expect(selection.lead).toEqual({ id: 'old-pinned' });
    expect(ids(selection.latest)).toEqual(ids(freshestPosts(6)));
  });

  it('новин менше семи — під головною всі інші', () => {
    const selection = pickHomePosts(
      { id: 'post-2' },
      freshestPosts(3),
      LATEST_COUNT,
    );
    expect(selection.lead).toEqual({ id: 'post-2' });
    expect(ids(selection.latest)).toEqual(['post-1', 'post-3']);
  });

  it('новин немає — головної немає', () => {
    expect(pickHomePosts(null, [], LATEST_COUNT)).toEqual({
      lead: null,
      latest: [],
    });
  });
});

const published: PinTarget = {
  status: PostStatus.PUBLISHED,
  publishedAt: PAST,
  pinnedAt: null,
};

function decide(request: Partial<PinRequest>) {
  return decidePin({
    target: published,
    currentPinnedPostId: null,
    replacesPostId: null,
    now: NOW,
    ...request,
  });
}

describe('decidePin — закріпити новину', () => {
  it('закріпленої немає й редактор не бачив жодної — закріпити', () => {
    expect(decide({})).toEqual({ kind: 'pin', unpinPostId: null });
  });

  it('заміна, яку підтвердив редактор, — зняти попередню й закріпити', () => {
    expect(
      decide({ currentPinnedPostId: 'pinned', replacesPostId: 'pinned' }),
    ).toEqual({ kind: 'pin', unpinPostId: 'pinned' });
  });

  it.each<[string, Partial<PinRequest>]>([
    [
      'закріплена змінилась після підтвердження',
      { currentPinnedPostId: 'other', replacesPostId: 'pinned' },
    ],
    [
      'редактор не бачив закріпленої, а вона є',
      { currentPinnedPostId: 'pinned', replacesPostId: null },
    ],
    [
      'закріплену відкріпили після підтвердження',
      { currentPinnedPostId: null, replacesPostId: 'pinned' },
    ],
  ])('%s → PINNED_POST_CHANGED', (_case, request) => {
    expect(decide(request)).toEqual({
      kind: 'rejected',
      errorCode: 'PINNED_POST_CHANGED',
    });
  });

  it('уже закріплена — без змін, навіть із застарілим підтвердженням', () => {
    expect(
      decide({
        target: { ...published, pinnedAt: PAST },
        currentPinnedPostId: 'self',
        replacesPostId: null,
      }),
    ).toEqual({ kind: 'alreadyPinned' });
  });

  it.each<[string, PinTarget]>([
    [
      'чернетка',
      { status: PostStatus.DRAFT, publishedAt: null, pinnedAt: null },
    ],
    [
      'ще не випущена запланована',
      { status: PostStatus.SCHEDULED, publishedAt: FUTURE, pinnedAt: null },
    ],
    [
      'архівна',
      { status: PostStatus.ARCHIVED, publishedAt: PAST, pinnedAt: null },
    ],
  ])('%s → POST_NOT_LIVE', (_case, target) => {
    expect(decide({ target })).toEqual({
      kind: 'rejected',
      errorCode: 'POST_NOT_LIVE',
    });
  });

  it('запланована, чия дата настала, — жива, закріпити можна', () => {
    expect(
      decide({ target: { ...published, status: PostStatus.SCHEDULED } }),
    ).toEqual({ kind: 'pin', unpinPostId: null });
  });
});

const livePublication: PostPublication = {
  status: PostStatus.PUBLISHED,
  publishedAt: PAST,
};

describe('unpinsOnPublicationChange — закріплення після оновлення новини', () => {
  it.each<[string, PostPublication]>([
    [
      'зняли з публікації (чернетка)',
      { status: PostStatus.DRAFT, publishedAt: null },
    ],
    ['в архів', { status: PostStatus.ARCHIVED, publishedAt: PAST }],
    [
      'перенесли в майбутнє',
      { status: PostStatus.SCHEDULED, publishedAt: FUTURE },
    ],
  ])('%s — зняти', (_case, next) => {
    expect(
      unpinsOnPublicationChange({ current: livePublication, next, now: NOW }),
    ).toBe(true);
  });

  it('правка тексту (публікація та сама) — лишається', () => {
    expect(
      unpinsOnPublicationChange({
        current: livePublication,
        next: { ...livePublication },
        now: NOW,
      }),
    ).toBe(false);
  });

  it('нова минула дата публікації — жива, лишається', () => {
    expect(
      unpinsOnPublicationChange({
        current: livePublication,
        next: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date('2026-10-01T08:00:00.000Z'),
        },
        now: NOW,
      }),
    ).toBe(false);
  });
});

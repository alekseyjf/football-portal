import {
  decodeCommentCursor,
  encodeCommentCursor,
  type CommentCursorContext,
} from './comment-cursor';

const POST_ROOTS: CommentCursorContext = {
  order: 'newest',
  scope: 'post:post-1',
};
/** Мілісекунди — точність `createdAt` (`timestamptz(3)`): курсор їх не губить. */
const POSITION = {
  createdAt: new Date('2026-10-27T21:15:30.123Z'),
  id: 'cmh1comment0000000000001',
};

function cursorOf(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

describe('курсор порції коментарів', () => {
  it('позиція повертається та сама, з мілісекундами', () => {
    const cursor = encodeCommentCursor(POST_ROOTS, POSITION);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCommentCursor(cursor, POST_ROOTS)).toEqual(POSITION);
  });

  it('курсор іншого списку — невалідний: інша новина, матч, гілка', () => {
    const cursor = encodeCommentCursor(POST_ROOTS, POSITION);
    for (const scope of [
      'post:post-2',
      'match:post-1',
      'replies:post-1',
    ] as const) {
      expect(
        decodeCommentCursor(cursor, { order: 'newest', scope }),
      ).toBeNull();
    }
  });

  it('курсор іншого порядку — невалідний', () => {
    const cursor = encodeCommentCursor(POST_ROOTS, POSITION);
    expect(
      decodeCommentCursor(cursor, { ...POST_ROOTS, order: 'oldest' }),
    ).toBeNull();
  });

  it('не base64url, не JSON, не об’єкт — невалідний', () => {
    for (const rawCursor of [
      'not a cursor!',
      Buffer.from('{"v":1,').toString('base64url'),
      cursorOf('newest'),
      cursorOf(null),
    ]) {
      expect(decodeCommentCursor(rawCursor, POST_ROOTS)).toBeNull();
    }
  });

  it('інша версія формату, порожній чи задовгий id — невалідний', () => {
    const valid = {
      v: 1,
      sort: 'newest',
      scope: 'post:post-1',
      createdAt: POSITION.createdAt.toISOString(),
      id: POSITION.id,
    };
    expect(decodeCommentCursor(cursorOf(valid), POST_ROOTS)).toEqual(POSITION);
    for (const payload of [
      { ...valid, v: 2 },
      { ...valid, id: '' },
      { ...valid, id: 'x'.repeat(65) },
      { ...valid, id: 42 },
    ]) {
      expect(decodeCommentCursor(cursorOf(payload), POST_ROOTS)).toBeNull();
    }
  });

  it('дата — лише та, яку видав API: без мілісекунд, з поясом, сміття — невалідна', () => {
    for (const createdAt of [
      '2026-10-27T21:15:30Z',
      '2026-10-28T00:15:30.123+03:00',
      '2026-10-27',
      'yesterday',
      1_793_000_000_000,
    ]) {
      const payload = {
        v: 1,
        sort: 'newest',
        scope: 'post:post-1',
        createdAt,
        id: POSITION.id,
      };
      expect(decodeCommentCursor(cursorOf(payload), POST_ROOTS)).toBeNull();
    }
  });
});

import { LikeType } from '@prisma/client';
import { splitCommentPage } from './comment-page';
import { toCommentItem } from './comment-response';
import type { CommentItemRow } from './comment.repository';

const CREATED_AT = new Date('2026-10-27T12:00:00.000Z');

function rows(count: number): { id: string; createdAt: Date }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `comment-${index + 1}`,
    createdAt: new Date(CREATED_AT.getTime() - index * 1000),
  }));
}

describe('splitCommentPage — порція з одним зайвим рядком', () => {
  it('рядків не більше за ліміт — порцій більше немає', () => {
    expect(splitCommentPage(rows(3), 3)).toEqual({
      pageRows: rows(3),
      nextPosition: null,
    });
    expect(splitCommentPage([], 3).nextPosition).toBeNull();
  });

  it('є зайвий — він не в порції, а курсор — позиція останнього виданого', () => {
    const page = splitCommentPage(rows(4), 3);
    expect(page.pageRows.map((row) => row.id)).toEqual([
      'comment-1',
      'comment-2',
      'comment-3',
    ]);
    expect(page.nextPosition).toEqual({
      id: 'comment-3',
      createdAt: rows(3)[2].createdAt,
    });
  });
});

const AUTHOR = {
  id: 'author',
  deletedAt: null,
  profile: { displayName: 'Olena', avatarUrl: null },
};
const ADDRESSEE = {
  id: 'addressee',
  deletedAt: null,
  profile: { displayName: 'Taras', avatarUrl: null },
};

function itemRow(overrides: Partial<CommentItemRow>): CommentItemRow {
  return {
    id: 'comment-1',
    parentId: null,
    content: 'Great match',
    deletedAt: null,
    createdAt: CREATED_AT,
    editedAt: null,
    likeCount: 4,
    replyCount: 2,
    replyToCommentId: null,
    author: AUTHOR,
    replyToUser: null,
    ...overrides,
  };
}

describe('toCommentItem — коментар порції', () => {
  it('живий корінь — текст, автор, лайки й мій голос', () => {
    expect(toCommentItem(itemRow({}), LikeType.LIKE)).toMatchObject({
      content: 'Great match',
      author: { id: 'author', name: 'Olena', isDeleted: false },
      isDeleted: false,
      likeCount: 4,
      myReaction: LikeType.LIKE,
      replyCount: 2,
      replyTo: null,
    });
  });

  it('видалений корінь з відповідями — заглушка без тексту й автора', () => {
    const stub = toCommentItem(itemRow({ deletedAt: CREATED_AT }), null);
    expect(stub).toMatchObject({
      isDeleted: true,
      content: null,
      author: null,
      replyCount: 2,
    });
  });

  it('відповідь на відповідь — адресат з профілю', () => {
    const reply = toCommentItem(
      itemRow({
        parentId: 'root',
        replyCount: 0,
        replyToCommentId: 'reply-1',
        replyToUser: ADDRESSEE,
      }),
      null,
    );
    expect(reply.replyTo).toEqual({
      commentId: 'reply-1',
      author: {
        id: 'addressee',
        name: 'Taras',
        avatarUrl: null,
        isDeleted: false,
      },
    });
  });

  it('адресата обнулено незалежно (SET NULL) — лишається те, що є', () => {
    expect(
      toCommentItem(
        itemRow({
          parentId: 'root',
          replyToCommentId: null,
          replyToUser: ADDRESSEE,
        }),
        null,
      ).replyTo,
    ).toEqual({
      commentId: null,
      author: {
        id: 'addressee',
        name: 'Taras',
        avatarUrl: null,
        isDeleted: false,
      },
    });
    expect(
      toCommentItem(
        itemRow({
          parentId: 'root',
          replyToCommentId: 'reply-1',
          replyToUser: null,
        }),
        null,
      ).replyTo,
    ).toEqual({ commentId: 'reply-1', author: null });
  });
});

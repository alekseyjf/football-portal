import { describe, expect, it } from 'vitest';
import type { CommentReplyTo } from '@/lib/api/types';
import { replyAddresseeName } from './reply-addressee';

const DELETED_USER = 'Видалений користувач';

function replyTo(author: CommentReplyTo['author']): CommentReplyTo {
  return { commentId: 'reply-1', author };
}

describe('«@Ім’я» адресата відповіді (D27)', () => {
  it('корінь чи відповідь на корінь — без адресата', () => {
    expect(replyAddresseeName(null, DELETED_USER)).toBeNull();
  });

  it('ім’я — з профілю адресата', () => {
    expect(
      replyAddresseeName(
        replyTo({ id: 'u1', name: 'Olena', avatarUrl: null, isDeleted: false }),
        DELETED_USER,
      ),
    ).toBe('Olena');
  });

  it('видалений акаунт — «Видалений користувач», а не ім’я з БД', () => {
    expect(
      replyAddresseeName(
        replyTo({
          id: 'u1',
          name: 'Deleted user',
          avatarUrl: null,
          isDeleted: true,
        }),
        DELETED_USER,
      ),
    ).toBe(DELETED_USER);
  });

  it('рядка користувача вже немає — теж «Видалений користувач»; коментар, кому відповіли, purge-нули — ім’я лишається', () => {
    expect(replyAddresseeName(replyTo(null), DELETED_USER)).toBe(DELETED_USER);
    expect(
      replyAddresseeName(
        {
          commentId: null,
          author: {
            id: 'u1',
            name: 'Olena',
            avatarUrl: null,
            isDeleted: false,
          },
        },
        DELETED_USER,
      ),
    ).toBe('Olena');
  });
});

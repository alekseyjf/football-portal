import { PostStatus } from '@prisma/client';
import { adminPostListWhere } from './admin-post-filter';

const NOT_DELETED = { deletedAt: null };

describe('adminPostListWhere', () => {
  it('без фільтрів — усі новини, крім видалених', () => {
    expect(adminPostListWhere({})).toEqual({ AND: [NOT_DELETED] });
  });

  it.each(Object.values(PostStatus))(
    '%s — статус як у БД (D57: запланована, чия дата настала, стає PUBLISHED воркером)',
    (status) => {
      expect(adminPostListWhere({ status })).toEqual({
        AND: [NOT_DELETED, { status }],
      });
    },
  );

  it('пошук — заголовок будь-якою мовою без урахування регістру, `%` — як текст; зі статусом — «і»', () => {
    expect(
      adminPostListWhere({ status: PostStatus.DRAFT, search: '100%' }),
    ).toEqual({
      AND: [
        NOT_DELETED,
        { status: PostStatus.DRAFT },
        {
          translations: {
            some: { title: { contains: '100\\%', mode: 'insensitive' } },
          },
        },
      ],
    });
  });
});

import { PostStatus } from '@prisma/client';
import { adminPostListWhere } from './admin-post-filter';
import { livePostWhere } from './post-visibility';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const NOT_DELETED = { deletedAt: null };

describe('adminPostListWhere', () => {
  it('без фільтрів — усі новини, крім видалених', () => {
    expect(adminPostListWhere({}, NOW)).toEqual({ AND: [NOT_DELETED] });
  });

  it('PUBLISHED — як бачить редактор: і запланована, чия дата настала (правило «на сайті» — `livePostWhere`)', () => {
    expect(adminPostListWhere({ status: PostStatus.PUBLISHED }, NOW)).toEqual({
      AND: [
        NOT_DELETED,
        { OR: [{ status: PostStatus.PUBLISHED }, livePostWhere(NOW)] },
      ],
    });
  });

  it('SCHEDULED — лише ті, що ще чекають своєї дати', () => {
    expect(adminPostListWhere({ status: PostStatus.SCHEDULED }, NOW)).toEqual({
      AND: [
        NOT_DELETED,
        { status: PostStatus.SCHEDULED, publishedAt: { gt: NOW } },
      ],
    });
  });

  it.each([PostStatus.DRAFT, PostStatus.ARCHIVED])(
    '%s — статус як є',
    (status) => {
      expect(adminPostListWhere({ status }, NOW)).toEqual({
        AND: [NOT_DELETED, { status }],
      });
    },
  );

  it('пошук — заголовок будь-якою мовою без урахування регістру, `%` — як текст; зі статусом — «і»', () => {
    expect(
      adminPostListWhere({ status: PostStatus.DRAFT, search: '100%' }, NOW),
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

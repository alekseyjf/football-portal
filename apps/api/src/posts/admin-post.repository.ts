import { Injectable } from '@nestjs/common';
import type { PostStatus, Prisma } from '@prisma/client';
import {
  CLUB_REF_SELECT,
  COMPETITION_REF_SELECT,
} from '../football/football-refs';
import { isRecordNotFound } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_TAG_REF_SELECT } from '../tags/tag.repository';
import { PUBLIC_AUTHOR_SELECT } from '../users/public-author';
import {
  adminPostListWhere,
  type AdminPostListFilters,
} from './admin-post-filter';

/** Рядок списку адмінки — і відповідь записів (`POST` / `PUT /posts`, закріплення). */
export const ADMIN_POST_SELECT = {
  id: true,
  number: true,
  slug: true,
  status: true,
  publishedAt: true,
  coverImageUrl: true,
  // Хто й коли закріпив — лише в адмінці, публічні відповіді цього не віддають (D56)
  pinnedAt: true,
  pinnedBy: { select: PUBLIC_AUTHOR_SELECT },
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  author: { select: PUBLIC_AUTHOR_SELECT },
  // В адмінці — усі мови: видно, яких перекладів бракує
  translations: {
    select: { languageCode: true, title: true },
    orderBy: { language: { sortOrder: 'asc' } },
  },
} satisfies Prisma.PostSelect;

/** Усе для форми редагування: поля, переклади з текстом, зв'язки у форматі чипів. */
const ADMIN_POST_DETAIL_SELECT = {
  ...ADMIN_POST_SELECT,
  coverImageCredit: true,
  videoUrl: true,
  sourceUrl: true,
  sourceName: true,
  translations: {
    select: {
      languageCode: true,
      title: true,
      excerpt: true,
      content: true,
      coverImageAlt: true,
    },
    orderBy: { language: { sortOrder: 'asc' } },
  },
  tags: {
    select: { tag: { select: ADMIN_TAG_REF_SELECT } },
    orderBy: { tag: { slug: 'asc' } },
  },
  competitions: {
    select: { competition: { select: COMPETITION_REF_SELECT } },
    orderBy: { competition: { sortOrder: 'asc' } },
  },
  clubs: {
    select: { club: { select: CLUB_REF_SELECT } },
    orderBy: { club: { name: 'asc' } },
  },
} satisfies Prisma.PostSelect;

/**
 * Що треба знати про пост перед оновленням: публікацію, адресу, slug з EN-заголовком (D24), обкладинку з описом
 * у кожному перекладі (D44), джерело (D26) і все, що бачить читач, — для події `post.updated` (D57).
 */
const POST_EDIT_STATE_SELECT = {
  id: true,
  number: true,
  status: true,
  publishedAt: true,
  slug: true,
  coverImageUrl: true,
  coverImageCredit: true,
  videoUrl: true,
  sourceUrl: true,
  sourceName: true,
  translations: {
    select: {
      languageCode: true,
      title: true,
      excerpt: true,
      content: true,
      coverImageAlt: true,
      updatedAt: true,
    },
  },
  tags: { select: { tagId: true } },
  clubs: { select: { clubId: true } },
  competitions: { select: { competitionId: true } },
} satisfies Prisma.PostSelect;

export type AdminPostRow = Prisma.PostGetPayload<{
  select: typeof ADMIN_POST_SELECT;
}>;
export type AdminPostDetailRow = Prisma.PostGetPayload<{
  select: typeof ADMIN_POST_DETAIL_SELECT;
}>;
export type PostEditStateRow = Prisma.PostGetPayload<{
  select: typeof POST_EDIT_STATE_SELECT;
}>;

/** Новина, яку щойно видалили: id, адреса й статус — для події `post.unpublished` (D57). */
const DELETED_POST_SELECT = {
  id: true,
  number: true,
  slug: true,
  status: true,
} satisfies Prisma.PostSelect;

export type DeletedPostRow = Prisma.PostGetPayload<{
  select: typeof DELETED_POST_SELECT;
}>;

export interface AdminPostPageQuery {
  filters: AdminPostListFilters;
  pagination: { skip: number; take: number };
}

export interface PostTranslationInput {
  languageCode: string;
  title: string;
  excerpt: string;
  content: string;
  /** Відсутній — при оновленні не змінюється */
  coverImageAlt?: string | null;
  /** Дата правки тексту (`translationTextUpdatedAt`, OQ-26): пишемо явно — `@updatedAt` Prisma зсунув би її й від опису фото */
  updatedAt: Date;
}

export interface PostRelationIds {
  tagIds?: string[];
  clubIds?: string[];
  competitionIds?: string[];
}

export interface CreatePostData extends PostRelationIds {
  slug: string;
  status: PostStatus;
  publishedAt: Date | null;
  coverImageUrl?: string | null;
  coverImageCredit?: string | null;
  videoUrl?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  authorId: string;
  translations: PostTranslationInput[];
}

export interface UpdatePostData extends PostRelationIds {
  /** Відсутні — публікація не змінюється (не перезаписуємо чужу зміну) */
  status?: PostStatus;
  publishedAt?: Date | null;
  /** Відсутній — slug не змінюється */
  slug?: string;
  coverImageUrl?: string | null;
  coverImageCredit?: string | null;
  videoUrl?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  /** Upsert за мовою; переклади, яких немає в масиві, не чіпаємо */
  translations?: PostTranslationInput[];
  /** Фото обкладинки змінилось чи прибране — прибрати опис у перекладах, яких немає в масиві (D44) */
  clearCoverImageAlts?: boolean;
  /** Новина перестала бути живою — зняти закріплення (D56) */
  unpin?: boolean;
}

function createRelation<Link>(
  ids: string[] | undefined,
  toLink: (id: string) => Link,
) {
  return ids?.length ? { create: ids.map(toLink) } : undefined;
}

/** Переданий масив замінює зв'язки повністю, відсутній — не чіпає (P3-8). */
function replaceRelation<Link>(
  ids: string[] | undefined,
  toLink: (id: string) => Link,
) {
  return ids ? { deleteMany: {}, create: ids.map(toLink) } : undefined;
}

/** Переклади з масиву — upsert за мовою, з датою правки тексту (OQ-26). */
function upsertTranslations(
  postId: string,
  translations: PostTranslationInput[] | undefined,
): Prisma.PostTranslationUpdateManyWithoutPostNestedInput | undefined {
  if (!translations) return undefined;
  return {
    upsert: translations.map((translation) => ({
      where: {
        postId_languageCode: { postId, languageCode: translation.languageCode },
      },
      create: translation,
      update: {
        title: translation.title,
        excerpt: translation.excerpt,
        content: translation.content,
        coverImageAlt: translation.coverImageAlt,
        updatedAt: translation.updatedAt,
      },
    })),
  };
}

/** Новини в адмінці: читання будь-якого статусу (крім видалених) і записи. */
@Injectable()
export class AdminPostRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Сторінка списку й кількість новин за тим самим `where` — з фільтрами статусу й пошуку. */
  async findAdminPage(
    pageQuery: AdminPostPageQuery,
  ): Promise<{ posts: AdminPostRow[]; total: number }> {
    const where = adminPostListWhere(pageQuery.filters);
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        select: ADMIN_POST_SELECT,
        // id — стабільний порядок пагінації при однаковій даті
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pageQuery.pagination.skip,
        take: pageQuery.pagination.take,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { posts, total };
  }

  findAdminDetail(id: string): Promise<AdminPostDetailRow | null> {
    return this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: ADMIN_POST_DETAIL_SELECT,
    });
  }

  /**
   * Блокує невидалену новину до кінця транзакції (`FOR NO KEY UPDATE`, backend Rule 10) і читає її стан для оновлення;
   * `null` — немає чи видалена. Рішення про публікацію й події — на заблокованому рядку: воркер розкладу (`SKIP LOCKED`),
   * що встиг першим, уже записав PUBLISHED, і повторної публікації (та події) не буде (D57).
   */
  async lockEditState(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<PostEditStateRow | null> {
    const lockedRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Post"
      WHERE "id" = ${id} AND "deletedAt" IS NULL
      FOR NO KEY UPDATE`;
    if (lockedRows.length === 0) return null;
    return tx.post.findUnique({
      where: { id },
      select: POST_EDIT_STATE_SELECT,
    });
  }

  create(data: CreatePostData): Promise<AdminPostRow> {
    return this.prisma.post.create({
      data: {
        slug: data.slug,
        status: data.status,
        publishedAt: data.publishedAt,
        coverImageUrl: data.coverImageUrl,
        coverImageCredit: data.coverImageCredit,
        videoUrl: data.videoUrl,
        sourceUrl: data.sourceUrl,
        sourceName: data.sourceName,
        authorId: data.authorId,
        translations: { create: data.translations },
        tags: createRelation(data.tagIds, (tagId) => ({ tagId })),
        clubs: createRelation(data.clubIds, (clubId) => ({ clubId })),
        competitions: createRelation(data.competitionIds, (competitionId) => ({
          competitionId,
        })),
      },
      select: ADMIN_POST_SELECT,
    });
  }

  /** Поля, переклади й зв'язки — разом, у транзакції, що тримає блокування новини (`lockEditState`). */
  async update(
    tx: Prisma.TransactionClient,
    id: string,
    data: UpdatePostData,
  ): Promise<AdminPostRow> {
    if (data.clearCoverImageAlts) {
      await this.clearCoverImageAlts(tx, id, data.translations ?? []);
    }
    return tx.post.update({
      where: { id },
      data: {
        status: data.status,
        publishedAt: data.publishedAt,
        slug: data.slug,
        coverImageUrl: data.coverImageUrl,
        coverImageCredit: data.coverImageCredit,
        videoUrl: data.videoUrl,
        sourceUrl: data.sourceUrl,
        sourceName: data.sourceName,
        ...(data.unpin
          ? { pinnedAt: null, pinnedBy: { disconnect: true } }
          : {}),
        translations: upsertTranslations(id, data.translations),
        tags: replaceRelation(data.tagIds, (tagId) => ({ tagId })),
        clubs: replaceRelation(data.clubIds, (clubId) => ({ clubId })),
        competitions: replaceRelation(data.competitionIds, (competitionId) => ({
          competitionId,
        })),
      },
      select: ADMIN_POST_SELECT,
    });
  }

  /**
   * Фото обкладинки змінилось чи прибране — опис старого прибираємо в перекладах поза запитом (D44); перекладам із
   * запиту опис пише upsert. Сирим SQL: опис — не текст, і `@updatedAt` Prisma не має зсувати дату правки (OQ-26).
   */
  private async clearCoverImageAlts(
    tx: Prisma.TransactionClient,
    postId: string,
    listedTranslations: readonly PostTranslationInput[],
  ): Promise<void> {
    const listedLanguageCodes = listedTranslations.map(
      (translation) => translation.languageCode,
    );
    await tx.$executeRaw`
      UPDATE "PostTranslation" SET "coverImageAlt" = NULL
      WHERE "postId" = ${postId}
        AND "coverImageAlt" IS NOT NULL
        AND "languageCode" <> ALL(${listedLanguageCodes}::text[])`;
  }

  /**
   * Soft delete разом зі зняттям закріплення (D56); статус у відповіді — той, з яким новину видалили (рядок тримає
   * блокування запису), — для події `post.unpublished`. `null` — поста немає або вже видалений (повтор → 404).
   */
  async softDelete(
    id: string,
    deletedAt: Date,
  ): Promise<DeletedPostRow | null> {
    try {
      return await this.prisma.post.update({
        where: { id, deletedAt: null },
        data: { deletedAt, pinnedAt: null, pinnedById: null },
        select: DELETED_POST_SELECT,
      });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }

  async countExistingRelations(ids: Required<PostRelationIds>) {
    const [tags, clubs, competitions] = await Promise.all([
      this.prisma.tag.count({ where: { id: { in: ids.tagIds } } }),
      this.prisma.club.count({ where: { id: { in: ids.clubIds } } }),
      this.prisma.competition.count({
        where: { id: { in: ids.competitionIds } },
      }),
    ]);
    return { tags, clubs, competitions };
  }
}

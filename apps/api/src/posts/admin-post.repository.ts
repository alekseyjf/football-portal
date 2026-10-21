import { Injectable } from '@nestjs/common';
import type { PostStatus, Prisma } from '@prisma/client';
import {
  CLUB_REF_SELECT,
  COMPETITION_REF_SELECT,
} from '../football/football-refs';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_TAG_REF_SELECT } from '../tags/tag.repository';
import { PUBLIC_AUTHOR_SELECT } from '../users/public-author';
import {
  adminPostListWhere,
  type AdminPostListFilters,
} from './admin-post-filter';

const ADMIN_POST_SELECT = {
  id: true,
  number: true,
  slug: true,
  status: true,
  publishedAt: true,
  coverImageUrl: true,
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
 * Що треба знати про пост перед оновленням: публікацію, slug з EN-заголовком (D24), обкладинку
 * з описом у кожному перекладі (D44) і джерело (D26).
 */
const POST_EDIT_STATE_SELECT = {
  status: true,
  publishedAt: true,
  slug: true,
  coverImageUrl: true,
  coverImageCredit: true,
  sourceUrl: true,
  sourceName: true,
  translations: {
    select: { languageCode: true, title: true, coverImageAlt: true },
  },
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

export interface AdminPostPageQuery {
  filters: AdminPostListFilters;
  /** Від нього рахується статус «як бачить редактор» */
  now: Date;
  pagination: { skip: number; take: number };
}

export interface PostTranslationInput {
  languageCode: string;
  title: string;
  excerpt: string;
  content: string;
  /** Відсутній — при оновленні не змінюється */
  coverImageAlt?: string | null;
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

/**
 * Переклади з масиву — upsert за мовою; решті — лише прибрати опис старого фото (D44). Переклади
 * з масиву `updateMany` не чіпає: їхній опис пише upsert, тож порядок nested-операцій неважливий.
 */
function updateTranslations(
  postId: string,
  postUpdate: UpdatePostData,
): Prisma.PostTranslationUpdateManyWithoutPostNestedInput | undefined {
  if (!postUpdate.translations && !postUpdate.clearCoverImageAlts) {
    return undefined;
  }
  const listedLanguageCodes = (postUpdate.translations ?? []).map(
    (translation) => translation.languageCode,
  );
  return {
    updateMany: postUpdate.clearCoverImageAlts
      ? {
          where: {
            coverImageAlt: { not: null },
            languageCode: { notIn: listedLanguageCodes },
          },
          data: { coverImageAlt: null },
        }
      : undefined,
    upsert: postUpdate.translations?.map((translation) => ({
      where: {
        postId_languageCode: { postId, languageCode: translation.languageCode },
      },
      create: translation,
      update: {
        title: translation.title,
        excerpt: translation.excerpt,
        content: translation.content,
        coverImageAlt: translation.coverImageAlt,
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
    const where = adminPostListWhere(pageQuery.filters, pageQuery.now);
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

  findEditState(id: string): Promise<PostEditStateRow | null> {
    return this.prisma.post.findFirst({
      where: { id, deletedAt: null },
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

  /**
   * Одна nested-операція = одна транзакція Prisma: поля, переклади й зв'язки
   * змінюються разом. Видалений пост → `P2025` (сервіс віддає 404).
   */
  update(id: string, data: UpdatePostData): Promise<AdminPostRow> {
    return this.prisma.post.update({
      where: { id, deletedAt: null },
      data: {
        status: data.status,
        publishedAt: data.publishedAt,
        slug: data.slug,
        coverImageUrl: data.coverImageUrl,
        coverImageCredit: data.coverImageCredit,
        videoUrl: data.videoUrl,
        sourceUrl: data.sourceUrl,
        sourceName: data.sourceName,
        translations: updateTranslations(id, data),
        tags: replaceRelation(data.tagIds, (tagId) => ({ tagId })),
        clubs: replaceRelation(data.clubIds, (clubId) => ({ clubId })),
        competitions: replaceRelation(data.competitionIds, (competitionId) => ({
          competitionId,
        })),
      },
      select: ADMIN_POST_SELECT,
    });
  }

  /** Soft delete; `false` — поста немає або вже видалений (повтор → 404). */
  async softDelete(id: string, deletedAt: Date): Promise<boolean> {
    const { count } = await this.prisma.post.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt },
    });
    return count === 1;
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

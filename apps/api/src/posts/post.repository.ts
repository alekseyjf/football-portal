import { Injectable } from '@nestjs/common';
import type { PostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_AUTHOR_SELECT } from '../users/public-author';
import { livePostWhere } from './post-visibility';

/**
 * Переклади лише потрібних мов (запитана + default, розділ 8): з N мовами
 * не тягнемо весь контент усіх перекладів.
 */
function translationsIn(languageCodes: string[]) {
  return { languageCode: { in: languageCodes } };
}

function postSummarySelect(languageCodes: string[]) {
  return {
    id: true,
    slug: true,
    publishedAt: true,
    coverImageUrl: true,
    author: { select: PUBLIC_AUTHOR_SELECT },
    translations: {
      where: translationsIn(languageCodes),
      select: { languageCode: true, title: true, excerpt: true },
    },
    tags: {
      select: {
        tag: {
          select: {
            id: true,
            slug: true,
            translations: {
              where: translationsIn(languageCodes),
              select: { languageCode: true, name: true },
            },
          },
        },
      },
      orderBy: { tag: { slug: 'asc' } },
    },
  } satisfies Prisma.PostSelect;
}

function postDetailSelect(languageCodes: string[]) {
  return {
    ...postSummarySelect(languageCodes),
    videoUrl: true,
    sourceUrl: true,
    translations: {
      where: translationsIn(languageCodes),
      select: {
        languageCode: true,
        title: true,
        excerpt: true,
        content: true,
      },
    },
    competitions: {
      select: {
        competition: {
          select: { id: true, slug: true, name: true, emblemUrl: true },
        },
      },
      orderBy: { competition: { sortOrder: 'asc' } },
    },
    clubs: {
      select: {
        club: {
          select: {
            id: true,
            slug: true,
            name: true,
            shortName: true,
            crestUrl: true,
          },
        },
      },
      orderBy: { club: { name: 'asc' } },
    },
  } satisfies Prisma.PostSelect;
}

const ADMIN_POST_SELECT = {
  id: true,
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

const POST_PUBLICATION_SELECT = {
  status: true,
  publishedAt: true,
} satisfies Prisma.PostSelect;

export type PostSummaryRow = Prisma.PostGetPayload<{
  select: ReturnType<typeof postSummarySelect>;
}>;
export type PostDetailRow = Prisma.PostGetPayload<{
  select: ReturnType<typeof postDetailSelect>;
}>;
export type AdminPostRow = Prisma.PostGetPayload<{
  select: typeof ADMIN_POST_SELECT;
}>;
export type PostPublicationRow = Prisma.PostGetPayload<{
  select: typeof POST_PUBLICATION_SELECT;
}>;

/** Що бачить публіка: живий пост (P3-1) з перекладом default-мови (P3-5). */
export interface PublicPostScope {
  now: Date;
  defaultLanguageCode: string;
}

export interface PostTranslationInput {
  languageCode: string;
  title: string;
  excerpt: string;
  content: string;
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
  videoUrl?: string | null;
  sourceUrl?: string | null;
  authorId: string;
  translations: PostTranslationInput[];
}

export interface UpdatePostData extends PostRelationIds {
  /** Відсутні — публікація не змінюється (не перезаписуємо чужу зміну) */
  status?: PostStatus;
  publishedAt?: Date | null;
  coverImageUrl?: string | null;
  videoUrl?: string | null;
  sourceUrl?: string | null;
  /** Upsert за мовою; переклади, яких немає в масиві, не чіпаємо */
  translations?: PostTranslationInput[];
}

function publicPostWhere(scope: PublicPostScope): Prisma.PostWhereInput {
  return {
    ...livePostWhere(scope.now),
    translations: { some: { languageCode: scope.defaultLanguageCode } },
  };
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

@Injectable()
export class PostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicPage(
    scope: PublicPostScope,
    languageCodes: string[],
    pagination: { skip: number; take: number },
  ): Promise<{ posts: PostSummaryRow[]; total: number }> {
    const where = publicPostWhere(scope);
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        select: postSummarySelect(languageCodes),
        // id — стабільний порядок пагінації при однаковій даті
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { posts, total };
  }

  findPublicBySlug(
    slug: string,
    scope: PublicPostScope,
    languageCodes: string[],
  ): Promise<PostDetailRow | null> {
    return this.prisma.post.findFirst({
      where: { slug, ...publicPostWhere(scope) },
      select: postDetailSelect(languageCodes),
    });
  }

  /** Мови, якими є переклад поста (для `hreflang`) — без самого контенту. */
  async findPublicTranslationLanguages(
    slug: string,
    scope: PublicPostScope,
  ): Promise<string[]> {
    const translations = await this.prisma.postTranslation.findMany({
      where: { post: { slug, ...publicPostWhere(scope) } },
      select: { languageCode: true },
      orderBy: { language: { sortOrder: 'asc' } },
    });
    return translations.map((translation) => translation.languageCode);
  }

  findAllForAdmin(): Promise<AdminPostRow[]> {
    return this.prisma.post.findMany({
      where: { deletedAt: null },
      select: ADMIN_POST_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  findPublicationState(id: string): Promise<PostPublicationRow | null> {
    return this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: POST_PUBLICATION_SELECT,
    });
  }

  create(data: CreatePostData): Promise<AdminPostRow> {
    return this.prisma.post.create({
      data: {
        slug: data.slug,
        status: data.status,
        publishedAt: data.publishedAt,
        coverImageUrl: data.coverImageUrl,
        videoUrl: data.videoUrl,
        sourceUrl: data.sourceUrl,
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
        coverImageUrl: data.coverImageUrl,
        videoUrl: data.videoUrl,
        sourceUrl: data.sourceUrl,
        translations: data.translations
          ? {
              upsert: data.translations.map((translation) => ({
                where: {
                  postId_languageCode: {
                    postId: id,
                    languageCode: translation.languageCode,
                  },
                },
                create: translation,
                update: {
                  title: translation.title,
                  excerpt: translation.excerpt,
                  content: translation.content,
                },
              })),
            }
          : undefined,
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

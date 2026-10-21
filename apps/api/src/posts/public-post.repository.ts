import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicTagSelect } from '../tags/tag.repository';
import { PUBLIC_AUTHOR_SELECT } from '../users/public-author';
import { postFeedFilterWhere, type PostFeedFilters } from './post-feed-filter';
import { publicPostWhere, type PublicPostScope } from './post-visibility';

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
    number: true,
    slug: true,
    publishedAt: true,
    coverImageUrl: true,
    author: { select: PUBLIC_AUTHOR_SELECT },
    translations: {
      where: translationsIn(languageCodes),
      select: {
        languageCode: true,
        title: true,
        excerpt: true,
        coverImageAlt: true,
      },
    },
    tags: {
      select: { tag: { select: publicTagSelect(languageCodes) } },
      orderBy: { tag: { slug: 'asc' } },
    },
  } satisfies Prisma.PostSelect;
}

function postDetailSelect(languageCodes: string[]) {
  return {
    ...postSummarySelect(languageCodes),
    coverImageCredit: true,
    videoUrl: true,
    sourceUrl: true,
    sourceName: true,
    translations: {
      where: translationsIn(languageCodes),
      select: {
        languageCode: true,
        title: true,
        excerpt: true,
        content: true,
        coverImageAlt: true,
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

export type PostSummaryRow = Prisma.PostGetPayload<{
  select: ReturnType<typeof postSummarySelect>;
}>;
export type PostDetailRow = Prisma.PostGetPayload<{
  select: ReturnType<typeof postDetailSelect>;
}>;

export interface PublicPostPageQuery {
  scope: PublicPostScope;
  filters: PostFeedFilters;
  /** Мови перекладів: запитана + default */
  languageCodes: string[];
  pagination: { skip: number; take: number };
}

/** Публічні читання: лише живі новини з перекладом default-мови (`publicPostWhere`, P3-1, P3-5). */
@Injectable()
export class PublicPostRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Сторінка стрічки й кількість новин за тим самим `where` — з фільтрами (D45, D46). */
  async findPublicPage(
    pageQuery: PublicPostPageQuery,
  ): Promise<{ posts: PostSummaryRow[]; total: number }> {
    const where: Prisma.PostWhereInput = {
      AND: [
        publicPostWhere(pageQuery.scope),
        postFeedFilterWhere(pageQuery.filters),
      ],
    };
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        select: postSummarySelect(pageQuery.languageCodes),
        // id — стабільний порядок пагінації при однаковій даті
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip: pageQuery.pagination.skip,
        take: pageQuery.pagination.take,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { posts, total };
  }

  findPublicByNumber(
    postNumber: number,
    scope: PublicPostScope,
    languageCodes: string[],
  ): Promise<PostDetailRow | null> {
    return this.prisma.post.findFirst({
      where: { number: postNumber, ...publicPostWhere(scope) },
      select: postDetailSelect(languageCodes),
    });
  }

  /** Мови, якими є переклад поста (для `hreflang`) — без самого контенту. */
  async findPublicTranslationLanguages(
    postNumber: number,
    scope: PublicPostScope,
  ): Promise<string[]> {
    const translations = await this.prisma.postTranslation.findMany({
      where: { post: { number: postNumber, ...publicPostWhere(scope) } },
      select: { languageCode: true },
      orderBy: { language: { sortOrder: 'asc' } },
    });
    return translations.map((translation) => translation.languageCode);
  }
}

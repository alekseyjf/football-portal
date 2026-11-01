import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  publicPostSql,
  publicPostWhere,
  type PublicPostScope,
} from './post-visibility';

/** Новини sitemap — ті самі, що в стрічці (`publicPostWhere`), переклади — лише увімкненими мовами. */
export interface SitemapPostsQuery {
  scope: PublicPostScope;
  /** Увімкнені мови: перекладу вимкненою адреси на сайті немає */
  languageCodes: string[];
  /** Межі `publishedAt`: `[from, before)`; без `before` — до now (`publicPostWhere`) */
  publishedFrom: Date;
  publishedBefore?: Date;
  take: number;
}

export interface SitemapMonthRow {
  month: string;
  postCount: number;
  lastModifiedAt: Date;
}

function translationsIn(languageCodes: string[]) {
  return { languageCode: { in: languageCodes } };
}

function sitemapPostsWhere(query: SitemapPostsQuery): Prisma.PostWhereInput {
  return {
    AND: [
      publicPostWhere(query.scope),
      {
        publishedAt: { gte: query.publishedFrom, lt: query.publishedBefore },
      },
    ],
  };
}

function sitemapPostSelect(languageCodes: string[]) {
  return {
    id: true,
    number: true,
    slug: true,
    publishedAt: true,
    translations: {
      where: translationsIn(languageCodes),
      select: { languageCode: true, updatedAt: true },
      orderBy: { language: { sortOrder: 'asc' } },
    },
  } satisfies Prisma.PostSelect;
}

function newsSitemapPostSelect(languageCodes: string[]) {
  return {
    id: true,
    number: true,
    slug: true,
    publishedAt: true,
    translations: {
      where: translationsIn(languageCodes),
      select: { languageCode: true, title: true },
      orderBy: { language: { sortOrder: 'asc' } },
    },
  } satisfies Prisma.PostSelect;
}

export type SitemapPostRow = Prisma.PostGetPayload<{
  select: ReturnType<typeof sitemapPostSelect>;
}>;
export type NewsSitemapPostRow = Prisma.PostGetPayload<{
  select: ReturnType<typeof newsSitemapPostSelect>;
}>;

/** Читання для sitemap сайту (D57). Порядок — як у стрічці: новіші першими. */
@Injectable()
export class PostSitemapRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Місяці (`publishedAt` в UTC) з кількістю новин і найсвіжішою зміною: дата зміни адреси — пізніша з дати
   * публікації й правки перекладу (`PostTranslation.updatedAt`; `Post.updatedAt` зсувають лайки). Сирий SQL —
   * Prisma не групує за виразом; предикат — `publicPostSql`, той самий, що в стрічці.
   */
  findMonths(
    scope: PublicPostScope,
    languageCodes: string[],
  ): Promise<SitemapMonthRow[]> {
    return this.prisma.$queryRaw<SitemapMonthRow[]>`
      SELECT to_char(post."publishedAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS "month",
        count(DISTINCT post."id")::int AS "postCount",
        max(GREATEST(post."publishedAt", translation."updatedAt")) AS "lastModifiedAt"
      FROM "Post" AS post
      JOIN "PostTranslation" AS translation
        ON translation."postId" = post."id"
        AND translation."languageCode" IN (${Prisma.join(languageCodes)})
      WHERE ${publicPostSql(scope)}
      GROUP BY 1
      ORDER BY 1 DESC`;
  }

  findPosts(query: SitemapPostsQuery): Promise<SitemapPostRow[]> {
    return this.prisma.post.findMany({
      where: sitemapPostsWhere(query),
      select: sitemapPostSelect(query.languageCodes),
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.take,
    });
  }

  findNewsPosts(query: SitemapPostsQuery): Promise<NewsSitemapPostRow[]> {
    return this.prisma.post.findMany({
      where: sitemapPostsWhere(query),
      select: newsSitemapPostSelect(query.languageCodes),
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.take,
    });
  }
}

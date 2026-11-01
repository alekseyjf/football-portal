import { PostStatus, Prisma } from '@prisma/client';

/**
 * Пост, який бачить публіка (D57): не видалений і опублікований. Запланований стає PUBLISHED лише воркером
 * (`ScheduledPostPublisher`, раз на хвилину), а не сам за датою, як було до M1.8.2 (P3-1): у мить публікації
 * з'являється подія `post.published`, яку чує сайт. Дата ≤ now — про запас: у PUBLISHED вона в минулому завжди.
 * Той самий предикат — для лайків / коментарів поста: чернетку не можна лайкнути за id.
 */
export function livePostWhere(now: Date): Prisma.PostWhereInput {
  return {
    deletedAt: null,
    status: PostStatus.PUBLISHED,
    publishedAt: { lte: now },
  };
}

/** Що бачить публіка: живий пост (D57) з перекладом default-мови (P3-5). */
export interface PublicPostScope {
  now: Date;
  defaultLanguageCode: string;
}

/**
 * Пост, який віддають `GET /posts`, `GET /posts/{number}` і sitemap: живий і з перекладом default-мови (P3-5).
 * Те саме правило — у публічному списку тегів: тег є у фільтрі, лише якщо стрічка з ним не порожня (D45).
 */
export function publicPostWhere(scope: PublicPostScope): Prisma.PostWhereInput {
  return {
    ...livePostWhere(scope.now),
    translations: { some: { languageCode: scope.defaultLanguageCode } },
  };
}

/**
 * `publicPostWhere` для сирого SQL (групування sitemap за місяцем — Prisma не групує за виразом); пост — під
 * псевдонімом `post`. Міняти разом з `publicPostWhere`: обидва перевіряє e2e sitemap.
 */
export function publicPostSql(scope: PublicPostScope): Prisma.Sql {
  return Prisma.sql`post."deletedAt" IS NULL
    AND post."status" = 'PUBLISHED'
    AND post."publishedAt" <= ${scope.now}
    AND EXISTS (
      SELECT 1 FROM "PostTranslation" AS "defaultTranslation"
      WHERE "defaultTranslation"."postId" = post."id"
        AND "defaultTranslation"."languageCode" = ${scope.defaultLanguageCode}
    )`;
}

/** Чи живий пост (для адмінки й відповідей, де рядок уже прочитано). */
export function isPostLive(
  post: {
    status: PostStatus;
    publishedAt: Date | null;
    deletedAt: Date | null;
  },
  now: Date,
): boolean {
  return (
    post.deletedAt === null &&
    post.status === PostStatus.PUBLISHED &&
    post.publishedAt !== null &&
    post.publishedAt.getTime() <= now.getTime()
  );
}

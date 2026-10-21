import { PostStatus, type Prisma } from '@prisma/client';

/** Статуси, які стають видимими, щойно настав `publishedAt` (P3-1). */
export const LIVE_POST_STATUSES = [
  PostStatus.PUBLISHED,
  PostStatus.SCHEDULED,
] as const;

/**
 * Пост, який бачить публіка (P3-1): не видалений, опублікований або запланований з датою,
 * що вже настала. Cron-а немає — SCHEDULED стає видимим сам (розділ 8).
 * Той самий предикат — для лайків / коментарів поста: чернетку не можна лайкнути за id.
 */
export function livePostWhere(now: Date): Prisma.PostWhereInput {
  return {
    deletedAt: null,
    status: { in: [...LIVE_POST_STATUSES] },
    publishedAt: { lte: now },
  };
}

/** Що бачить публіка: живий пост (P3-1) з перекладом default-мови (P3-5). */
export interface PublicPostScope {
  now: Date;
  defaultLanguageCode: string;
}

/**
 * Пост, який віддають `GET /posts` і `GET /posts/{number}`: живий і з перекладом default-мови (P3-5).
 * Те саме правило — у публічному списку тегів: тег є у фільтрі, лише якщо стрічка з ним не порожня (D45).
 */
export function publicPostWhere(scope: PublicPostScope): Prisma.PostWhereInput {
  return {
    ...livePostWhere(scope.now),
    translations: { some: { languageCode: scope.defaultLanguageCode } },
  };
}

/** Статус, з яким пост видимий, щойно настав `publishedAt`: PUBLISHED або SCHEDULED (P3-1). */
export function isLivePostStatus(status: PostStatus): boolean {
  return (LIVE_POST_STATUSES as readonly PostStatus[]).includes(status);
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
    isLivePostStatus(post.status) &&
    post.publishedAt !== null &&
    post.publishedAt.getTime() <= now.getTime()
  );
}

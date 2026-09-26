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
    (LIVE_POST_STATUSES as readonly PostStatus[]).includes(post.status) &&
    post.publishedAt !== null &&
    post.publishedAt.getTime() <= now.getTime()
  );
}

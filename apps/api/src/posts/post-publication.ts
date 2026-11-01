import { PostStatus } from '@prisma/client';

export interface PostPublication {
  status: PostStatus;
  publishedAt: Date | null;
}

export type PostPublicationErrorCode =
  | 'POST_STATUS_NOT_ALLOWED'
  | 'PUBLISHED_AT_NOT_ALLOWED'
  | 'PUBLISHED_AT_REQUIRED'
  | 'PUBLISHED_AT_IN_FUTURE'
  | 'PUBLISHED_AT_LOCKED'
  | 'SCHEDULED_AT_IN_PAST';

export type PostPublicationResult =
  | { isValid: true; publication: PostPublication }
  | { isValid: false; errorCode: PostPublicationErrorCode };

export interface PostPublicationInput {
  /** `null` — пост створюється */
  current: PostPublication | null;
  requestedStatus?: PostStatus;
  requestedPublishedAt?: Date;
  now: Date;
}

/**
 * PUBLISHED або SCHEDULED: новина на сайті або вийде сама — воркером у свою дату (D57). Для неї діють правила
 * опублікованої: опис і підпис обкладинки (D44).
 */
export function isPublishingStatus(status: PostStatus): boolean {
  return status === PostStatus.PUBLISHED || status === PostStatus.SCHEDULED;
}

/**
 * Статус і дата публікації після створення / оновлення (P3-2, D57). Тримає CHECK
 * `Post_published_has_date_check` (PUBLISHED / SCHEDULED ⇒ є дата) на рівні сервісу:
 * - DRAFT — без дати (з будь-якого статусу: архівна в чернетку — «почати заново», D50);
 * - PUBLISHED — дата ≤ now (минула — перенесення старих новин); без дати в запиті — наявна минула або now;
 * - SCHEDULED — дата > now (з запиту або наявна); виходить воркером, а не сама;
 * - ARCHIVED — лише для наявного поста, дата не змінюється;
 * - дата опублікованої незмінна (`isPublicationDateLocked`): інша дата чи SCHEDULED → `PUBLISHED_AT_LOCKED`.
 * Оновлення без дати, де статус не змінюється, публікацію не чіпає — інакше правка заголовка запланованої,
 * чия дата настала, а воркер ще не пройшов, падала б на «дата в минулому».
 */
export function resolvePostPublication(
  input: PostPublicationInput,
): PostPublicationResult {
  const { current, requestedStatus, requestedPublishedAt, now } = input;
  const nextStatus = requestedStatus ?? current?.status ?? PostStatus.DRAFT;

  if (
    current &&
    requestedPublishedAt === undefined &&
    nextStatus === current.status
  ) {
    return valid(current);
  }

  switch (nextStatus) {
    case PostStatus.DRAFT:
      if (requestedPublishedAt !== undefined) {
        return invalid('PUBLISHED_AT_NOT_ALLOWED');
      }
      return valid({ status: nextStatus, publishedAt: null });

    case PostStatus.PUBLISHED:
      return resolvePublished(input);

    case PostStatus.SCHEDULED: {
      // Опублікована знову запланованою не стає: лише знімається з публікації (D57)
      if (current && isPublicationDateLocked(current)) {
        return invalid('PUBLISHED_AT_LOCKED');
      }
      const scheduledAt =
        requestedPublishedAt ??
        (current?.status === PostStatus.SCHEDULED ? current.publishedAt : null);
      if (!scheduledAt) return invalid('PUBLISHED_AT_REQUIRED');
      if (scheduledAt.getTime() <= now.getTime()) {
        return invalid('SCHEDULED_AT_IN_PAST');
      }
      return valid({ status: nextStatus, publishedAt: scheduledAt });
    }

    case PostStatus.ARCHIVED:
      if (!current) return invalid('POST_STATUS_NOT_ALLOWED');
      if (requestedPublishedAt !== undefined) {
        return invalid('PUBLISHED_AT_NOT_ALLOWED');
      }
      return valid({ status: nextStatus, publishedAt: current.publishedAt });
  }
}

/**
 * Дата публікації незмінна, щойно новина вийшла (D57): опублікована й архівна з датою. Інакше sitemap за місяцями,
 * Google News і посилання, що вже розійшлись, бачили б «нову» стару новину. Архівна без дати — знята з чернеток.
 */
export function isPublicationDateLocked(publication: PostPublication): boolean {
  return (
    publication.publishedAt !== null &&
    (publication.status === PostStatus.PUBLISHED ||
      publication.status === PostStatus.ARCHIVED)
  );
}

function resolvePublished(input: PostPublicationInput): PostPublicationResult {
  const { current, requestedPublishedAt, now } = input;
  const currentPublishedAt = current?.publishedAt ?? null;

  if (requestedPublishedAt !== undefined) {
    // Той самий момент — не зміна: повторний запит з датою, яку вже записано, проходить
    const isSameDate =
      currentPublishedAt?.getTime() === requestedPublishedAt.getTime();
    if (current && isPublicationDateLocked(current) && !isSameDate) {
      return invalid('PUBLISHED_AT_LOCKED');
    }
    return requestedPublishedAt.getTime() > now.getTime()
      ? invalid('PUBLISHED_AT_IN_FUTURE')
      : valid({
          status: PostStatus.PUBLISHED,
          publishedAt: requestedPublishedAt,
        });
  }
  // Раніше опублікований (архівний) і запланований, чия дата настала (воркер ще не пройшов), — зберігають дату:
  // ту саму поставив би воркер; чернетка або запланований, чия дата не настала, — «опублікувати зараз»
  const keepsDate =
    currentPublishedAt !== null &&
    currentPublishedAt.getTime() <= now.getTime();
  return valid({
    status: PostStatus.PUBLISHED,
    publishedAt: keepsDate ? currentPublishedAt : now,
  });
}

export function isSamePublication(
  first: PostPublication,
  second: PostPublication,
): boolean {
  return (
    first.status === second.status &&
    first.publishedAt?.getTime() === second.publishedAt?.getTime()
  );
}

function valid(publication: PostPublication): PostPublicationResult {
  return { isValid: true, publication };
}

function invalid(errorCode: PostPublicationErrorCode): PostPublicationResult {
  return { isValid: false, errorCode };
}

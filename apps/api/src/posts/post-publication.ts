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
 * Статус і дата публікації після створення / оновлення (P3-2). Тримає CHECK
 * `Post_published_has_date_check` (PUBLISHED / SCHEDULED ⇒ є дата) на рівні сервісу:
 * - DRAFT — без дати;
 * - PUBLISHED — дата ≤ now (минула — backdating); без дати в запиті — наявна минула або now;
 * - SCHEDULED — дата > now (з запиту або наявна);
 * - ARCHIVED — лише для наявного поста, дата не змінюється.
 * Оновлення без дати, де статус не змінюється, публікацію не чіпає — інакше правка
 * заголовка запланованого поста, що вже вийшов, падала б на «дата в минулому».
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

    case PostStatus.PUBLISHED: {
      if (requestedPublishedAt !== undefined) {
        return requestedPublishedAt.getTime() > now.getTime()
          ? invalid('PUBLISHED_AT_IN_FUTURE')
          : valid({ status: nextStatus, publishedAt: requestedPublishedAt });
      }
      // Раніше опублікований (у т.ч. архівований або запланований, що вже вийшов) —
      // зберігає дату; чернетка або ще не настала дата запланованого — «опублікувати зараз»
      const currentPublishedAt = current?.publishedAt ?? null;
      const keepsDate =
        currentPublishedAt !== null &&
        currentPublishedAt.getTime() <= now.getTime();
      return valid({
        status: nextStatus,
        publishedAt: keepsDate ? currentPublishedAt : now,
      });
    }

    case PostStatus.SCHEDULED: {
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

function valid(publication: PostPublication): PostPublicationResult {
  return { isValid: true, publication };
}

function invalid(errorCode: PostPublicationErrorCode): PostPublicationResult {
  return { isValid: false, errorCode };
}

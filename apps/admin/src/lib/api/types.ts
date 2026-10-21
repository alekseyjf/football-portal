import type { AdminPost, PublicAuthor } from '@football-portal/types';

/**
 * Типи API — згенеровані з OpenAPI-документа API (`@football-portal/types`, D28). Тут — лише
 * підписи для інтерфейсу адмінки.
 */
export type {
  AdminPost,
  AuthUserResponse,
  CreatePostRequest,
  FootballSyncAccepted,
  LoginRequest,
  MessageResponse,
  PaginatedAdminPosts,
  PostTranslationRequest,
  SyncRun,
  SyncRunStats,
  UserAccount,
} from '@football-portal/types';

/** Підпис мови в інтерфейсі: код усередині — `uk`, напис — «Укр» (D22). */
const LANGUAGE_SHORT_LABELS: Record<string, string> = { en: 'Eng', uk: 'Укр' };

export function languageShortLabel(languageCode: string): string {
  return LANGUAGE_SHORT_LABELS[languageCode] ?? languageCode.toUpperCase();
}

export function adminPostTitle(
  post: AdminPost,
  languageCode: string = 'en',
): string {
  return (
    post.translations.find(
      (translation) => translation.languageCode === languageCode,
    )?.title ??
    post.translations[0]?.title ??
    'Untitled'
  );
}

/** Статус, що бачить редактор: запланований, чия дата настала, уже на сайті. */
export function adminPostStatusLabel(post: AdminPost): string {
  if (post.isLive) return 'Published';
  switch (post.status) {
    case 'DRAFT':
      return 'Draft';
    case 'SCHEDULED':
      return 'Scheduled';
    case 'PUBLISHED':
      return 'Published';
    case 'ARCHIVED':
      return 'Archived';
  }
}

/** Ім'я автора в списках: видалений акаунт — підпис, а не ім'я з БД. */
export function adminAuthorName(author: PublicAuthor): string {
  return author.isDeleted ? 'Deleted user' : author.name;
}

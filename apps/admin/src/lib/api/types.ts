import type { AdminPost, PublicAuthor } from '@football-portal/types';

/**
 * Типи API — згенеровані з OpenAPI-документа API (`@football-portal/types`, D28). Тут — лише
 * підписи для інтерфейсу адмінки.
 */
export type {
  AdminClubSearchResult,
  AdminLeague,
  AdminPost,
  AdminPostDetail,
  AdminTag,
  AdminTagRef,
  AuthUserResponse,
  ClubRef,
  CompetitionRef,
  CreatePostRequest,
  CreateTagRequest,
  DeletedPost,
  DeletedTag,
  FootballSyncAccepted,
  LoginRequest,
  MessageResponse,
  PaginatedAdminPosts,
  PinnedAdminPost,
  PinPostRequest,
  PostTranslationRequest,
  SyncRun,
  SyncRunStats,
  TagTranslationRequest,
  UpdatePostRequest,
  UpdateTagRequest,
  UserAccount,
} from '@football-portal/types';

export function adminPostTitle(
  post: Pick<AdminPost, 'translations'>,
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
export function adminPostStatusLabel(post: Pick<AdminPost, 'isLive' | 'status'>): string {
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

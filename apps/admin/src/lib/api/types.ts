import type { PostStatus, PublicAuthor, User } from '@football-portal/types';

export type { PostStatus };

/** Рядок списку GET /posts/admin/all (і відповідь POST / PUT /posts). */
export interface AdminPostRow {
  id: string;
  slug: string;
  status: PostStatus;
  publishedAt: string | null;
  /** Видно на сайті зараз: SCHEDULED з датою, що настала, — теж */
  isLive: boolean;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author: PublicAuthor;
  /** Усі мови, якими є переклад */
  translations: { languageCode: string; title: string }[];
}

export function adminPostTitle(
  post: AdminPostRow,
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
export function adminPostStatusLabel(post: AdminPostRow): string {
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

/** Тіло POST /posts (CreatePostDto). Без `status` — чернетка. */
export interface CreatePostPayload {
  translations: Array<{
    languageCode: string;
    title: string;
    excerpt: string;
    content: string;
  }>;
  /** ARCHIVED — лише для наявного поста */
  status?: Exclude<PostStatus, 'ARCHIVED'>;
  /** ISO з часовою зоною; для SCHEDULED — обов'язково, у майбутньому */
  publishedAt?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  sourceUrl?: string;
  tagIds?: string[];
  clubIds?: string[];
  competitionIds?: string[];
}

/** Користувач з `POST /auth/login` (адмінку пускаємо лише з `role: ADMIN`). */
export type AdminUser = User;

/** Ім'я автора в списках: видалений акаунт — підпис, а не ім'я з БД. */
export function adminAuthorName(author: PublicAuthor): string {
  return author.isDeleted ? 'Deleted user' : author.name;
}

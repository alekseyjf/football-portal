import type { PublicAuthor, User } from '@football-portal/types';

/** Рядок списку GET /posts/admin/all */
export interface AdminPostRow {
  id: string;
  slug: string;
  published: boolean;
  createdAt: string;
  author: PublicAuthor;
  translations: { language: string; title: string }[];
}

export function adminPostTitle(
  post: AdminPostRow,
  lang: string = 'en',
): string {
  return (
    post.translations.find((t) => t.language === lang)?.title ??
    post.translations[0]?.title ??
    'Untitled'
  );
}

/** Тіло POST /posts (CreatePostDto) */
export interface CreatePostPayload {
  translations: Array<{
    language: 'en' | 'ua';
    title: string;
    excerpt: string;
    content: string;
  }>;
  coverImage?: string;
  videoUrl?: string;
  published?: boolean;
  sourceUrl?: string;
  tagIds?: string[];
}

/** Користувач з `POST /auth/login` (адмінку пускаємо лише з `role: ADMIN`). */
export type AdminUser = User;

/** Ім'я автора в списках: видалений акаунт — підпис, а не ім'я з БД. */
export function adminAuthorName(author: PublicAuthor): string {
  return author.isDeleted ? 'Deleted user' : author.name;
}

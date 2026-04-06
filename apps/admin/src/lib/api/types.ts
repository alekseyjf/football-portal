/** Рядок списку GET /posts/admin/all */
export interface AdminPostRow {
  id: string;
  slug: string;
  published: boolean;
  createdAt: string;
  author: { id: string; name: string; avatar?: string };
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

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
}

import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { AdminPostRow } from '@/lib/api/types';

const ADMIN_POSTS_LANG = 'en';

export function adminPostsQueryOptions(lang: string = ADMIN_POSTS_LANG) {
  return queryOptions({
    queryKey: ['admin', 'posts', lang] as const,
    queryFn: () =>
      apiGet<AdminPostRow[]>(
        `/posts/admin/all?lang=${encodeURIComponent(lang)}`,
      ),
    staleTime: 30 * 1000,
  });
}

export function useAdminPosts(lang: string = ADMIN_POSTS_LANG) {
  return useQuery(adminPostsQueryOptions(lang));
}

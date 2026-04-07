import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import {
  DEFAULT_CONTENT_LANG,
  type PaginatedPosts,
} from '@/lib/api/types';

export function postsQueryOptions(
  page: number,
  limit: number,
  lang: string,
) {
  return queryOptions({
    queryKey: ['posts', page, limit, lang] as const,
    queryFn: () =>
      apiGet<PaginatedPosts>(
        `/posts?page=${page}&limit=${limit}&lang=${encodeURIComponent(lang)}`,
      ),
    staleTime: 60 * 1000,
  });
}

export function usePosts(
  page = 1,
  limit = 10,
  lang: string = DEFAULT_CONTENT_LANG,
) {
  return useQuery(postsQueryOptions(page, limit, lang));
}

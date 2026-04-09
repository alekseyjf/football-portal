import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import {
  DEFAULT_CONTENT_LANG,
  type ApiContentLanguage,
  type PostDetail,
} from '@/lib/api/types';

export function postDetailQueryOptions(slug: string, lang: ApiContentLanguage) {
  return queryOptions({
    queryKey: ['post', 'detail', slug, lang] as const,
    queryFn: () =>
      apiGet<PostDetail>(
        `/posts/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`,
      ),
    staleTime: 60 * 1000,
  });
}

export function usePostDetail(
  slug: string,
  lang: ApiContentLanguage = DEFAULT_CONTENT_LANG,
) {
  return useQuery(postDetailQueryOptions(slug, lang));
}

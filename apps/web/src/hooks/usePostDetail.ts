import { queryOptions } from '@tanstack/react-query';
import { postDetailCache } from '@/lib/api/cache-tags';
import { apiGet } from '@/lib/api/http';
import type { ApiContentLanguage, PostDetail } from '@/lib/api/types';

/** Новину визначає номер з URL `{slug}-{number}` (D24); на сервері — з кешу, його оновлює подія новини (M1.8.3). */
export function fetchPostDetail(postNumber: number, lang: ApiContentLanguage) {
  return apiGet<PostDetail>(
    `/posts/${postNumber}?lang=${encodeURIComponent(lang)}`,
    postDetailCache(postNumber),
  );
}

export function postDetailQueryOptions(
  postNumber: number,
  lang: ApiContentLanguage,
) {
  return queryOptions({
    queryKey: ['post', 'detail', postNumber, lang] as const,
    queryFn: () => fetchPostDetail(postNumber, lang),
    staleTime: 60 * 1000,
  });
}

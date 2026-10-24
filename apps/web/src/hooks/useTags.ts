import { queryOptions } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import { nullIfNotFound } from '@/lib/api/not-found';
import type { ApiContentLanguage, Tag } from '@/lib/api/types';

/** Тег за slug — назва мовою сторінки в чипі фільтра стрічки; `null` — тегу немає (видалили, D45). */
export function tagQueryOptions(tagSlug: string, lang: ApiContentLanguage) {
  return queryOptions({
    queryKey: ['tags', 'detail', tagSlug, lang] as const,
    queryFn: () =>
      nullIfNotFound(
        apiGet<Tag>(
          `/tags/${encodeURIComponent(tagSlug)}?lang=${encodeURIComponent(lang)}`,
        ),
      ),
    staleTime: 5 * 60_000,
  });
}

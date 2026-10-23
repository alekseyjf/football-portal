import {
  ADMIN_CLUBS_SEARCH_MAX_LENGTH,
  ADMIN_CLUBS_SEARCH_MIN_LENGTH,
} from '@football-portal/validation';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { AdminClubSearchResult } from '@/lib/api/types';

/**
 * Пошук клубів для адмінки (`GET /football/clubs/admin/search`, D48): запит коротший за 2 чи довший за 100 символів
 * не надсилається (API відповів би 400). Паузу у вводі робить той, хто викликає (`useDebouncedValue`).
 */
export function useAdminClubSearch(search: string) {
  const trimmedSearch = search.trim();
  return useQuery({
    queryKey: ['admin', 'football', 'clubs', trimmedSearch] as const,
    queryFn: () =>
      apiGet<AdminClubSearchResult[]>(`/football/clubs/admin/search?search=${encodeURIComponent(trimmedSearch)}`),
    enabled:
      trimmedSearch.length >= ADMIN_CLUBS_SEARCH_MIN_LENGTH && trimmedSearch.length <= ADMIN_CLUBS_SEARCH_MAX_LENGTH,
    // Клуби оновлює синк раз на дві години
    staleTime: 5 * 60 * 1000,
  });
}

import {
  ADMIN_CLUBS_SEARCH_MAX_LENGTH,
  ADMIN_CLUBS_SEARCH_MIN_LENGTH,
} from '@football-portal/validation';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { AdminClubSearchResult } from '@/lib/api/types';

const LATIN_LETTER_OR_DIGIT = /[\p{Script=Latin}\p{N}]/u;

/** Назви клубів — латиницею (D42): текст без латиниці й цифр серед них не знайдеться. */
export function hasLatinLetterOrDigit(text: string): boolean {
  return LATIN_LETTER_OR_DIGIT.test(text);
}

/** Запит, який варто надсилати: 2–100 символів після trim (інакше API відповів би 400) і є латиниця чи цифра. */
export function isClubSearchText(search: string): boolean {
  const trimmedSearch = search.trim();
  return (
    trimmedSearch.length >= ADMIN_CLUBS_SEARCH_MIN_LENGTH &&
    trimmedSearch.length <= ADMIN_CLUBS_SEARCH_MAX_LENGTH &&
    hasLatinLetterOrDigit(trimmedSearch)
  );
}

/**
 * Пошук клубів для адмінки (`GET /football/clubs/admin/search`, D48): запит, що нічого не знайде чи якого API не прийме
 * (`isClubSearchText`), не надсилається. Паузу у вводі робить той, хто викликає (`useDebouncedValue`).
 */
export function useAdminClubSearch(search: string) {
  const trimmedSearch = search.trim();
  return useQuery({
    queryKey: ['admin', 'football', 'clubs', trimmedSearch] as const,
    queryFn: () =>
      apiGet<AdminClubSearchResult[]>(`/football/clubs/admin/search?search=${encodeURIComponent(trimmedSearch)}`),
    enabled: isClubSearchText(trimmedSearch),
    // Клуби оновлює синк раз на дві години
    staleTime: 5 * 60 * 1000,
  });
}

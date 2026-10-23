import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { AdminLeague } from '@/lib/api/types';

/** Усі турніри для адмінки (`GET /football/leagues/admin/all`, D48) — і вимкнені, у порядку редакції. */
export function useAdminLeagues() {
  return useQuery({
    queryKey: ['admin', 'football', 'leagues'] as const,
    queryFn: () => apiGet<AdminLeague[]>('/football/leagues/admin/all'),
    // Турніри додає й вимикає редакція в БД — за сесію адмінки вони майже не змінюються
    staleTime: 10 * 60 * 1000,
  });
}

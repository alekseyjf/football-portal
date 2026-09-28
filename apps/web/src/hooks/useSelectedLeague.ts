'use client';

import { useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LEAGUE_QUERY_PARAM,
  leagueSlugFromParam,
} from '@/lib/football/league-param';

/**
 * Обрана ліга сайдбару: `?league=` або ліга за замовчуванням (сервер обрав її за тим самим
 * правилом і вже зробив prefetch дашборду).
 *
 * Перемикання — `history.pushState`: Next.js синхронізує з ним `useSearchParams`, тож сторінка
 * не рендериться на сервері знову (стрічка не перезапитується), дашборд нової ліги тягне
 * TanStack Query (кеш — на лігу). «Назад» у браузері повертає попередню лігу.
 */
export function useSelectedLeague(defaultLeagueSlug: string | null) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const leagueSlug =
    leagueSlugFromParam(searchParams.get(LEAGUE_QUERY_PARAM)) ??
    defaultLeagueSlug;

  /** Повний URL ліги: для `href` (нова вкладка, копіювання) і для `pushState`. */
  const leagueHref = useCallback(
    (targetLeagueSlug: string) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set(LEAGUE_QUERY_PARAM, targetLeagueSlug);
      return `${pathname}?${nextSearchParams.toString()}`;
    },
    [pathname, searchParams],
  );

  const selectLeague = useCallback(
    (targetLeagueSlug: string) => {
      window.history.pushState(null, '', leagueHref(targetLeagueSlug));
    },
    [leagueHref],
  );

  return { leagueSlug, leagueHref, selectLeague };
}

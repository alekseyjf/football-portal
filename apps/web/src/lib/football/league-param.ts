/**
 * Обрана ліга сайдбару головної — у query: `/en?league=CL`. Сервер бачить її в `searchParams`
 * (SSR + prefetch дашборду), клієнт — у `useSearchParams` (перемикання без перезавантаження).
 */
export const LEAGUE_QUERY_PARAM = 'league';

/**
 * Slug ліги з query. Кілька значень (`?league=CL&league=PL`) — перше, як і
 * `URLSearchParams.get` на клієнті, щоб сервер і клієнт обрали ту саму лігу.
 * Порожнє → `null` (ліга за замовчуванням).
 */
export function leagueSlugFromParam(
  paramValue: string | string[] | null | undefined,
): string | null {
  const firstValue = Array.isArray(paramValue) ? paramValue[0] : paramValue;
  return firstValue?.trim() || null;
}

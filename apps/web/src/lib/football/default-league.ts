import type { League } from '@/lib/api/types';

/** Вбудовується при збірці (`NEXT_PUBLIC_*`); порожнє значення — змінної немає. */
const ENV_DEFAULT_LEAGUE_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG?.trim() || null;

/**
 * Ліга сайдбару головної без `?league=` (P5b-2, уточнено в M1.6.3 — D55): спершу турнір «у грі» (D48) — ліга з env,
 * якщо вона «у грі», інакше перша «у грі» за `sortOrder` (API вже відсортував); не в грі жоден (міжсезоння) — env,
 * якщо ліга серед активних, інакше перша активна. Вимкнена в адмінці ліга (`isActive = false`) за замовчуванням не
 * відкривається — лише за посиланням. Список не завантажився (API недоступне) — env як є.
 */
export function resolveDefaultLeagueSlug(
  activeLeagues: League[] | null,
  envLeagueSlug: string | null = ENV_DEFAULT_LEAGUE_SLUG,
): string | null {
  if (!activeLeagues) return envLeagueSlug;
  const envLeague = activeLeagues.find(
    (league) => league.slug === envLeagueSlug,
  );
  if (envLeague?.isInPlay) return envLeague.slug;
  const firstInPlay = activeLeagues.find((league) => league.isInPlay);
  return firstInPlay?.slug ?? envLeague?.slug ?? activeLeagues[0]?.slug ?? null;
}

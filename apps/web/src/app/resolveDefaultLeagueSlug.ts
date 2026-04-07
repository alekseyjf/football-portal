import { apiGet } from '@/lib/api/http';
import type { FootballLeagueMeta } from '@/lib/api/types';

/** Slug ліги для сайдбару: env або перша ліга з API. */
export async function resolveDefaultLeagueSlug(): Promise<string | null> {
  const env = process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG?.trim();
  if (env) return env;
  try {
    const leagues = await apiGet<FootballLeagueMeta[]>('/football/leagues');
    return leagues[0]?.slug ?? null;
  } catch {
    return null;
  }
}

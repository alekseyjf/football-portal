import type { MatchDetail } from '@/lib/api/types';

/** «Господарі – Гості» — назва матчу у вкладці, прев'ю й картці соцмереж. Назви клубів не перекладаємо (D42). */
export function matchTitle(
  match: Pick<MatchDetail, 'homeClub' | 'awayClub'>,
): string {
  return `${match.homeClub.name} – ${match.awayClub.name}`;
}

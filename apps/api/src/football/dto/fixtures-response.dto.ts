import { MatchRowDto } from './match-response.dto';

/**
 * Тур: у лізі, ліга-фазі й групах — `(stage, matchday)`; у плей-оф — уся стадія (`matchday: null`,
 * обидва матчі раунду разом).
 */
export class FixturesRoundDto {
  stage!: string;
  matchday!: number | null;
  matches!: MatchRowDto[];
}

/** Тури сезону. */
export class LeagueFixturesDto {
  /** Від сьогодні й ті, що йдуть зараз, — найближчі першими */
  upcoming!: FixturesRoundDto[];
  /** До сьогодні — останні першими */
  past!: FixturesRoundDto[];
}

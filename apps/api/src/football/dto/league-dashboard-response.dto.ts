import { LeagueFixturesDto } from './fixtures-response.dto';
import { LeagueDto, SeasonDto } from './league-response.dto';
import { StandingRowDto, StandingTableRefDto } from './standing-response.dto';

/** Сайдбар турніру одним запитом: головна таблиця й тури. */
export class LeagueDashboardDto {
  league!: LeagueDto;
  /** `null` — турнір ще не синкали */
  season!: SeasonDto | null;
  /**
   * Яка таблиця в `standings` (заголовок: таблиця ліги / ліга-фаза / група); `null` — таблиці немає:
   * турнір ще не синкали або провайдер її не дає
   */
  standingsTable!: StandingTableRefDto | null;
  /** Головна таблиця: ліга, ліга-фаза або перша група (`TOTAL`) */
  standings!: StandingRowDto[];
  fixtures!: LeagueFixturesDto;
}

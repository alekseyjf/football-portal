import { ADMIN_CLUBS_SEARCH_RESULTS_MAX } from '@football-portal/validation';
import { Injectable } from '@nestjs/common';
import type { AdminClubSearchResultDto } from '../dto/club-response.dto';
import type { AdminLeagueDto } from '../dto/league-response.dto';
import {
  CLUB_SEARCH_CANDIDATES_MAX,
  rankClubSearchResults,
} from '../football-club-search';
import {
  isCompetitionInPlay,
  type CompetitionSeasonState,
} from '../football-competition-status';
import { COMPETITION_IN_PLAY_GRACE_DAYS } from '../football.constants';
import {
  FootballAdminRepository,
  type ClubParticipationRow,
} from '../persistence/football-admin.repository';
import { toAdminClubSearchResult, toAdminLeague } from './football-response';

function competitionSeasonStateOf({
  season,
}: ClubParticipationRow): CompetitionSeasonState {
  return {
    isActive: season.competition.isActive,
    isCurrent: season.isCurrent,
    endDate: season.endDate,
    pendingMatchCount: season._count.matches,
  };
}

/**
 * Футбол для адмінки — вибір турнірів і клубів у формі новини (D47, D48): будь-які турніри, пошук клубів із синку.
 * Публічні читання — `FootballQueryService`.
 */
@Injectable()
export class FootballAdminQueryService {
  constructor(
    private readonly footballAdminRepository: FootballAdminRepository,
  ) {}

  async getAdminLeagues(): Promise<AdminLeagueDto[]> {
    const competitions =
      await this.footballAdminRepository.findAllCompetitions();
    return competitions.map(toAdminLeague);
  }

  /**
   * До 20 клубів за запитом: збіги (до стелі 200 за абеткою) упорядковує правило пошуку, а не `take: 20` у БД —
   * інакше клуб, що починається з запиту, міг би не потрапити в перші 20 за абеткою. Турніри — одним запитом
   * на всі клуби результату, лише ті, що «у грі» (D48).
   */
  async searchClubs(search: string): Promise<AdminClubSearchResultDto[]> {
    const candidates = await this.footballAdminRepository.findClubsBySearch(
      search,
      CLUB_SEARCH_CANDIDATES_MAX,
    );
    const clubs = rankClubSearchResults(
      candidates,
      search,
      ADMIN_CLUBS_SEARCH_RESULTS_MAX,
    );
    if (clubs.length === 0) return [];

    const now = new Date();
    const participations =
      await this.footballAdminRepository.findCurrentSeasonParticipations(
        clubs.map((club) => club.id),
        now,
        COMPETITION_IN_PLAY_GRACE_DAYS,
      );
    const participationsInPlay = participations.filter((participation) =>
      isCompetitionInPlay(
        competitionSeasonStateOf(participation),
        now,
        COMPETITION_IN_PLAY_GRACE_DAYS,
      ),
    );
    return clubs.map((club) =>
      toAdminClubSearchResult(
        club,
        participationsInPlay.filter(
          (participation) => participation.clubId === club.id,
        ),
      ),
    );
  }
}

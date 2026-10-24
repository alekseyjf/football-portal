import type { AdminClubSearchResultDto } from '../dto/club-response.dto';
import type {
  AdminLeagueDto,
  LeagueDto,
  SeasonDto,
} from '../dto/league-response.dto';
import type {
  MatchDetailDto,
  MatchListItemDto,
} from '../dto/match-response.dto';
import type {
  StandingRowDto,
  StandingTableDto,
} from '../dto/standing-response.dto';
import type {
  AdminCompetitionRow,
  ClubParticipationRow,
  ClubSearchRow,
} from '../persistence/football-admin.repository';
import { isCompetitionInPlay } from '../football-competition-status';
import { COMPETITION_IN_PLAY_GRACE_DAYS } from '../football.constants';
import type {
  LeagueRecord,
  MatchDetailRecord,
  MatchListRecord,
  SeasonRecord,
  StandingRowRecord,
} from '../persistence/football.repository';

/** Сезон у публічних відповідях: дати — `YYYY-MM-DD` (у БД `@db.Date`). */
export function toPublicSeason(season: SeasonRecord): SeasonDto {
  return {
    label: season.label,
    isCurrent: season.isCurrent,
    currentMatchday: season.currentMatchday,
    startDate: season.startDate.toISOString().slice(0, 10),
    endDate: season.endDate.toISOString().slice(0, 10),
  };
}

/**
 * `GET /football/leagues[/:slug]`, `league` у дашборді (6.4). «У грі» — правило D48 на мить `now`; турнір без
 * поточного сезону (ще не синкали) — ні.
 */
export function toPublicLeague(league: LeagueRecord, now: Date): LeagueDto {
  const currentSeason = league.seasons[0];
  return {
    id: league.id,
    slug: league.slug,
    name: league.name,
    type: league.type,
    emblemUrl: league.emblemUrl,
    area: league.area,
    currentSeason: currentSeason ? toPublicSeason(currentSeason) : null,
    isInPlay:
      currentSeason !== undefined &&
      isCompetitionInPlay(
        {
          isActive: league.isActive,
          isCurrent: currentSeason.isCurrent,
          endDate: currentSeason.endDate,
          pendingMatchCount: currentSeason._count.matches,
        },
        now,
        COMPETITION_IN_PLAY_GRACE_DAYS,
      ),
  };
}

function toPublicStandingRow(standingRow: StandingRowRecord): StandingRowDto {
  return {
    position: standingRow.position,
    played: standingRow.played,
    won: standingRow.won,
    drawn: standingRow.drawn,
    lost: standingRow.lost,
    points: standingRow.points,
    goalsFor: standingRow.goalsFor,
    goalsAgainst: standingRow.goalsAgainst,
    goalDiff: standingRow.goalDiff,
    form: standingRow.form,
    club: standingRow.club,
  };
}

/** Рядки, відсортовані за `(stage, groupName, type, position)` → таблиці `[{ stage, groupName, type, rows }]`. */
export function toPublicStandingTables(
  standingRows: StandingRowRecord[],
): StandingTableDto[] {
  const tables: StandingTableDto[] = [];
  for (const standingRow of standingRows) {
    const groupName = standingRow.groupName || null;
    const lastTable = tables.at(-1);
    if (
      lastTable?.stage === standingRow.stage &&
      lastTable.groupName === groupName &&
      lastTable.type === standingRow.type
    ) {
      lastTable.rows.push(toPublicStandingRow(standingRow));
    } else {
      tables.push({
        stage: standingRow.stage,
        groupName,
        type: standingRow.type,
        rows: [toPublicStandingRow(standingRow)],
      });
    }
  }
  return tables;
}

/** `GET /football/matches/:id`: `competition` → `league` — як у решті публічного API. */
export function toPublicMatchDetail(match: MatchDetailRecord): MatchDetailDto {
  const { competition, ...matchFields } = match;
  return { ...matchFields, league: competition };
}

/** `GET /football/matches?from=&to=`: рядок матчу + його турнір (`league`), як у деталі. */
export function toPublicMatchListItem(
  match: MatchListRecord,
): MatchListItemDto {
  const { competition, ...matchFields } = match;
  return { ...matchFields, league: competition };
}

/** Турнір у виборі адмінки (D48): поля чипа, тип і чи ввімкнений. */
export function toAdminLeague(
  competition: AdminCompetitionRow,
): AdminLeagueDto {
  return {
    id: competition.id,
    slug: competition.slug,
    name: competition.name,
    type: competition.type,
    isActive: competition.isActive,
  };
}

/**
 * Клуб у пошуку адмінки (D48): поля чипа, імена, за якими шукали, і турніри — з рядків участі, які вже відібрало
 * правило «у грі», у тому ж порядку (турніри — за `sortOrder`).
 */
export function toAdminClubSearchResult(
  club: ClubSearchRow,
  participationsInPlay: readonly ClubParticipationRow[],
): AdminClubSearchResultDto {
  return {
    id: club.id,
    slug: club.slug,
    name: club.name,
    shortName: club.shortName,
    tla: club.tla,
    crestUrl: club.crestUrl,
    competitions: participationsInPlay.map(({ season: { competition } }) => ({
      id: competition.id,
      slug: competition.slug,
      name: competition.name,
    })),
  };
}

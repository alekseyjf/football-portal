import type { LeagueDto, SeasonDto } from '../dto/league-response.dto';
import type {
  MatchDetailDto,
  MatchListItemDto,
} from '../dto/match-response.dto';
import type {
  StandingRowDto,
  StandingTableDto,
} from '../dto/standing-response.dto';
import type {
  CompetitionRecord,
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

/** `GET /football/leagues[/:slug]`, `league` у дашборді (6.4). */
export function toPublicLeague(competition: CompetitionRecord): LeagueDto {
  const currentSeason = competition.seasons[0];
  return {
    id: competition.id,
    slug: competition.slug,
    name: competition.name,
    type: competition.type,
    emblemUrl: competition.emblemUrl,
    area: competition.area,
    currentSeason: currentSeason ? toPublicSeason(currentSeason) : null,
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

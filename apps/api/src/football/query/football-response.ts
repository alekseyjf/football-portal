import type {
  CompetitionRecord,
  MatchDetailRecord,
  MatchListRecord,
  SeasonRecord,
  StandingRowRecord,
} from '../persistence/football.repository';

/** Сезон у публічних відповідях: дати — `YYYY-MM-DD` (у БД `@db.Date`). */
export function toPublicSeason(season: SeasonRecord) {
  return {
    label: season.label,
    isCurrent: season.isCurrent,
    currentMatchday: season.currentMatchday,
    startDate: season.startDate.toISOString().slice(0, 10),
    endDate: season.endDate.toISOString().slice(0, 10),
  };
}

export type PublicSeason = ReturnType<typeof toPublicSeason>;

/** `GET /football/leagues[/:slug]`, `league` у дашборді (6.4). */
export function toPublicLeague(competition: CompetitionRecord) {
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

function toPublicStandingRow(standingRow: StandingRowRecord) {
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

export type PublicStandingTable = {
  stage: string;
  groupName: string | null;
  type: StandingRowRecord['type'];
  rows: ReturnType<typeof toPublicStandingRow>[];
};

/** Рядки, відсортовані за `(stage, groupName, type, position)` → таблиці `[{ stage, groupName, type, rows }]`. */
export function toPublicStandingTables(
  standingRows: StandingRowRecord[],
): PublicStandingTable[] {
  const tables: PublicStandingTable[] = [];
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
export function toPublicMatchDetail(match: MatchDetailRecord) {
  const { competition, ...matchFields } = match;
  return { ...matchFields, league: competition };
}

/** `GET /football/matches?from=&to=`: рядок матчу + його турнір (`league`), як у деталі. */
export function toPublicMatchListItem(match: MatchListRecord) {
  const { competition, ...matchFields } = match;
  return { ...matchFields, league: competition };
}

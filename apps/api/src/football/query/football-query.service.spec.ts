import { CompetitionType, MatchStatus, StandingType } from '@prisma/client';
import type {
  CompetitionRecord,
  FootballRepository,
  MatchRowRecord,
  SeasonRecord,
  StandingRowRecord,
} from '../persistence/football.repository';
import { FootballQueryService } from './football-query.service';

const SEASON: SeasonRecord = {
  id: 'season-1',
  label: '2026/27',
  isCurrent: true,
  currentMatchday: 2,
  startDate: new Date('2026-09-08T00:00:00Z'),
  endDate: new Date('2027-01-27T00:00:00Z'),
};

function competition(
  type: CompetitionType,
  seasons: SeasonRecord[],
): CompetitionRecord {
  return {
    id: 'competition-1',
    slug: type === CompetitionType.CUP ? 'CL' : 'PL',
    name: 'Competition',
    type,
    emblemUrl: null,
    area: null,
    seasons,
  };
}

const CLUB = {
  id: 'club-1',
  slug: 'club',
  name: 'Club',
  shortName: null,
  tla: null,
  crestUrl: null,
};

function standingRow(
  stage: string,
  type: StandingType,
  position: number,
): StandingRowRecord {
  return {
    stage,
    groupName: '',
    type,
    position,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    form: null,
    club: CLUB,
  };
}

function matchRow(
  id: string,
  stage: string,
  matchday: number | null,
  kickoffIso: string,
): MatchRowRecord {
  return {
    id,
    kickoffAt: new Date(kickoffIso),
    status: MatchStatus.SCHEDULED,
    minute: null,
    matchday,
    stage,
    groupName: null,
    homeScore: null,
    awayScore: null,
    homeClub: CLUB,
    awayClub: CLUB,
  };
}

function queryServiceWith(repositoryData: {
  competition: CompetitionRecord;
  standingRows?: StandingRowRecord[];
  upcomingMatches?: MatchRowRecord[];
}) {
  const repository = {
    findCompetitionBySlug: () => Promise.resolve(repositoryData.competition),
    findStandingRows: () => Promise.resolve(repositoryData.standingRows ?? []),
    findUpcomingMatches: () =>
      Promise.resolve(repositoryData.upcomingMatches ?? []),
    findPastMatches: () => Promise.resolve([]),
  };
  return new FootballQueryService(repository as unknown as FootballRepository);
}

describe('FootballQueryService.getLeagueDashboard', () => {
  it('кубок: standingsTable — ліга-фаза (TOTAL), тури — за стадіями', async () => {
    const dashboard = await queryServiceWith({
      competition: competition(CompetitionType.CUP, [SEASON]),
      standingRows: [
        standingRow('LEAGUE_STAGE', StandingType.TOTAL, 1),
        standingRow('LEAGUE_STAGE', StandingType.TOTAL, 2),
        standingRow('LEAGUE_STAGE', StandingType.HOME, 1),
      ],
      upcomingMatches: [
        matchRow('md2', 'LEAGUE_STAGE', 2, '2026-09-30T19:00:00Z'),
        matchRow('po', 'PLAYOFFS', null, '2027-02-16T20:00:00Z'),
      ],
    }).getLeagueDashboard('CL');

    expect(dashboard.standingsTable).toEqual({
      stage: 'LEAGUE_STAGE',
      groupName: null,
    });
    expect(dashboard.standings.map((row) => row.position)).toEqual([1, 2]);
    expect(
      dashboard.fixtures.upcoming.map((round) => [round.stage, round.matchday]),
    ).toEqual([
      ['LEAGUE_STAGE', 2],
      ['PLAYOFFS', null],
    ]);
  });

  it('сезон є, таблиці немає (EC 2024) — standingsTable: null', async () => {
    const dashboard = await queryServiceWith({
      competition: competition(CompetitionType.CUP, [SEASON]),
    }).getLeagueDashboard('EC');

    expect(dashboard.season?.label).toBe('2026/27');
    expect(dashboard.standingsTable).toBeNull();
    expect(dashboard.standings).toEqual([]);
  });

  it('турнір ще не синкали — season і standingsTable: null, без 404', async () => {
    const dashboard = await queryServiceWith({
      competition: competition(CompetitionType.LEAGUE, []),
    }).getLeagueDashboard('PL');

    expect(dashboard.season).toBeNull();
    expect(dashboard.standingsTable).toBeNull();
    expect(dashboard.fixtures).toEqual({ upcoming: [], past: [] });
  });
});

import { CompetitionType, MatchStatus, StandingType } from '@prisma/client';
import type {
  CompetitionRecord,
  FootballRepository,
  MatchListRecord,
  MatchRowRecord,
  SeasonRecord,
  StandingRowRecord,
} from '../persistence/football.repository';
import { MATCH_RANGE_MAX_ROWS } from './football-match-range';
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

describe('FootballQueryService.getMatchesInRange', () => {
  function serviceWithListRows(listRows: MatchListRecord[]) {
    const repositoryCalls: unknown[][] = [];
    const repository = {
      findMatchesInRange: (...callArgs: unknown[]) => {
        repositoryCalls.push(callArgs);
        return Promise.resolve(listRows);
      },
    };
    return {
      service: new FootballQueryService(
        repository as unknown as FootballRepository,
      ),
      repositoryCalls,
    };
  }

  it('межі → Date, slug-и без дублів, competition → league', async () => {
    const { service, repositoryCalls } = serviceWithListRows([
      {
        ...matchRow('m1', 'REGULAR_SEASON', 7, '2026-10-10T11:30:00Z'),
        competition: {
          id: 'competition-1',
          slug: 'PL',
          name: 'Premier League',
          type: CompetitionType.LEAGUE,
          emblemUrl: null,
        },
      },
    ]);

    const response = await service.getMatchesInRange({
      from: '2026-10-10T00:00:00+03:00',
      to: '2026-10-11T00:00:00+03:00',
      league: 'PL,PL',
    });

    expect(repositoryCalls).toEqual([
      [
        new Date('2026-10-09T21:00:00Z'),
        new Date('2026-10-10T21:00:00Z'),
        ['PL'],
        MATCH_RANGE_MAX_ROWS,
      ],
    ]);
    expect(response.matches.map((match) => match.league.slug)).toEqual(['PL']);
    expect(response.matches[0]).not.toHaveProperty('competition');
  });

  it('без league — null (лише активні турніри)', async () => {
    const { service, repositoryCalls } = serviceWithListRows([]);

    await service.getMatchesInRange({
      from: '2026-10-10T00:00:00Z',
      to: '2026-10-11T00:00:00Z',
    });

    expect(repositoryCalls[0][2]).toBeNull();
  });

  it('невалідний інтервал → 400 без запиту до БД', async () => {
    const { service, repositoryCalls } = serviceWithListRows([]);

    await expect(
      service.getMatchesInRange({
        from: '2026-10-11T00:00:00Z',
        to: '2026-10-10T00:00:00Z',
      }),
    ).rejects.toThrow('MATCH_RANGE_INVALID');
    expect(repositoryCalls).toHaveLength(0);
  });
});

import {
  ClubKind,
  MatchStatus,
  MatchWinner,
  StandingType,
} from '@prisma/client';
import { FootballProviderError } from '../football-provider.port';
import {
  mapFdCompetition,
  mapFdMatch,
  mapFdMatchStatus,
  mapFdStandingsResponse,
  mapFdTeamsResponse,
  normalizeFdGroupName,
  normalizeFdStage,
  seasonLabelFromDates,
} from './football-data.mapper';
import type { FdMatch } from './football-data.types';

/** Зразки — з реальних відповідей football-data v4 (2026-09-26, план 5.1). */
const WC_SEASON = {
  id: 2398,
  startDate: '2026-06-11',
  endDate: '2026-07-19',
  currentMatchday: 3,
};

const GERMANY_PARAGUAY_ON_PENALTIES: FdMatch = {
  season: WC_SEASON,
  id: 537415,
  utcDate: '2026-06-29T20:30:00Z',
  status: 'FINISHED',
  matchday: null,
  stage: 'LAST_32',
  group: null,
  homeTeam: {
    id: 759,
    name: 'Germany',
    shortName: 'Germany',
    tla: 'GER',
    crest: 'https://crests.football-data.org/759.svg',
  },
  awayTeam: {
    id: 761,
    name: 'Paraguay',
    shortName: 'Paraguay',
    tla: 'PAR',
    crest: 'https://crests.football-data.org/761.svg',
  },
  score: {
    winner: 'AWAY_TEAM',
    duration: 'PENALTY_SHOOTOUT',
    fullTime: { home: 4, away: 5 },
    halfTime: { home: 0, away: 1 },
    regularTime: { home: 1, away: 1 },
    extraTime: { home: 0, away: 0 },
    penalties: { home: 3, away: 4 },
  },
};

describe('football-data mapper', () => {
  describe('score (F2)', () => {
    it('серія пенальті не потрапляє в рахунок матчу', () => {
      const providerMatch = mapFdMatch(GERMANY_PARAGUAY_ON_PENALTIES);
      expect(providerMatch.score).toEqual({
        home: 1,
        away: 1,
        homeHalfTime: 0,
        awayHalfTime: 1,
        homePenalties: 3,
        awayPenalties: 4,
      });
      expect(providerMatch.winner).toBe(MatchWinner.AWAY);
    });

    it('додатковий час рахується в рахунок (BEL–SEN 2:2 + 1:0)', () => {
      const providerMatch = mapFdMatch({
        ...GERMANY_PARAGUAY_ON_PENALTIES,
        score: {
          winner: 'HOME_TEAM',
          duration: 'EXTRA_TIME',
          fullTime: { home: 3, away: 2 },
          halfTime: { home: 0, away: 1 },
          regularTime: { home: 2, away: 2 },
          extraTime: { home: 1, away: 0 },
        },
      });
      expect(providerMatch.score.home).toBe(3);
      expect(providerMatch.score.away).toBe(2);
      expect(providerMatch.score.homePenalties).toBeNull();
    });

    it('без regularTime — fullTime мінус серія; звичайний матч — fullTime як є', () => {
      const withoutBreakdown = mapFdMatch({
        ...GERMANY_PARAGUAY_ON_PENALTIES,
        score: {
          fullTime: { home: 4, away: 5 },
          penalties: { home: 3, away: 4 },
        },
      });
      expect([
        withoutBreakdown.score.home,
        withoutBreakdown.score.away,
      ]).toEqual([1, 1]);

      const regular = mapFdMatch({
        ...GERMANY_PARAGUAY_ON_PENALTIES,
        score: {
          winner: 'HOME_TEAM',
          duration: 'REGULAR',
          fullTime: { home: 2, away: 0 },
          halfTime: { home: 1, away: 0 },
        },
      });
      expect([regular.score.home, regular.score.away]).toEqual([2, 0]);
    });

    it('ще не зіграний матч — рахунок null', () => {
      const scheduled = mapFdMatch({
        ...GERMANY_PARAGUAY_ON_PENALTIES,
        status: 'TIMED',
        score: {
          winner: null,
          duration: 'REGULAR',
          fullTime: { home: null, away: null },
          halfTime: { home: null, away: null },
        },
      });
      expect(scheduled.status).toBe(MatchStatus.SCHEDULED);
      expect(scheduled.score.home).toBeNull();
      expect(scheduled.winner).toBeNull();
    });
  });

  it('матч: id рядками, стадія, група, тур, сезон', () => {
    const groupMatch = mapFdMatch({
      ...GERMANY_PARAGUAY_ON_PENALTIES,
      id: 537327,
      matchday: 1,
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
    });
    expect(groupMatch).toMatchObject({
      externalId: '537327',
      seasonExternalId: '2398',
      stage: 'GROUP_STAGE',
      groupName: 'GROUP_A',
      matchday: 1,
      kickoffAt: new Date('2026-06-29T20:30:00Z'),
      homeClub: { externalId: '759', name: 'Germany', tla: 'GER' },
      minute: null,
    });
  });

  it('учасник плей-оф не визначений → клуб null (F5)', () => {
    const undecided = mapFdMatch({
      ...GERMANY_PARAGUAY_ON_PENALTIES,
      homeTeam: { id: null, name: null },
    });
    expect(undecided.homeClub).toBeNull();
    expect(undecided.awayClub?.externalId).toBe('761');
  });

  it('матч без сезону / з поганою датою → INVALID_RESPONSE', () => {
    expect(() =>
      mapFdMatch({ ...GERMANY_PARAGUAY_ON_PENALTIES, season: null }),
    ).toThrow(FootballProviderError);
    expect(() =>
      mapFdMatch({ ...GERMANY_PARAGUAY_ON_PENALTIES, utcDate: 'nope' }),
    ).toThrow(FootballProviderError);
  });

  it('статуси 1:1; EXTRA_TIME / PENALTY_SHOOTOUT → LIVE; невідомий → SCHEDULED', () => {
    expect(mapFdMatchStatus('PAUSED')).toBe(MatchStatus.PAUSED);
    expect(mapFdMatchStatus('SUSPENDED')).toBe(MatchStatus.SUSPENDED);
    expect(mapFdMatchStatus('AWARDED')).toBe(MatchStatus.AWARDED);
    expect(mapFdMatchStatus('IN_PLAY')).toBe(MatchStatus.LIVE);
    expect(mapFdMatchStatus('PENALTY_SHOOTOUT')).toBe(MatchStatus.LIVE);
    expect(mapFdMatchStatus('TIMED')).toBe(MatchStatus.SCHEDULED);
    expect(mapFdMatchStatus('SOMETHING_NEW')).toBe(MatchStatus.SCHEDULED);
  });

  it('група: лише GROUP_*; «Matchday» / «League phase» — не група (F3)', () => {
    expect(normalizeFdGroupName('GROUP_A')).toBe('GROUP_A');
    expect(normalizeFdGroupName('Group B')).toBe('GROUP_B');
    expect(normalizeFdGroupName('Matchday')).toBeNull();
    expect(normalizeFdGroupName('League phase')).toBeNull();
    expect(normalizeFdGroupName(null)).toBeNull();
  });

  it('стадія: A-Z0-9_ як є, порожня → REGULAR_SEASON (D18)', () => {
    expect(normalizeFdStage('LAST_16')).toBe('LAST_16');
    expect(normalizeFdStage('league stage')).toBe('LEAGUE_STAGE');
    expect(normalizeFdStage(null)).toBe('REGULAR_SEASON');
  });

  it('label сезону: 2026 у межах року, 2026/27 через рік', () => {
    expect(seasonLabelFromDates('2026-06-11', '2026-07-19')).toBe('2026');
    expect(seasonLabelFromDates('2026-08-21', '2027-05-30')).toBe('2026/27');
    expect(seasonLabelFromDates('2099-08-01', '2100-05-30')).toBe('2099/00');
  });

  it('турнір: area, сезон, рід учасників (збірні — WC / EC, F7)', () => {
    const worldCup = mapFdCompetition({
      id: 2000,
      code: 'WC',
      name: 'FIFA World Cup',
      emblem: 'https://crests.football-data.org/wm26.png',
      area: { id: 2267, name: 'World', code: 'INT', flag: null },
      currentSeason: WC_SEASON,
    });
    expect(worldCup).toEqual({
      externalId: '2000',
      name: 'FIFA World Cup',
      emblemUrl: 'https://crests.football-data.org/wm26.png',
      area: { code: 'INT', name: 'World', flagUrl: null },
      participantKind: ClubKind.NATIONAL,
      currentSeason: {
        externalId: '2398',
        label: '2026',
        startDate: '2026-06-11',
        endDate: '2026-07-19',
        currentMatchday: 3,
      },
    });
    expect(
      mapFdCompetition({ id: 2001, code: 'CL', name: 'UEFA Champions League' })
        .participantKind,
    ).toBe(ClubKind.CLUB);
  });

  it('склад: збірні WC — NATIONAL, повні поля клубу', () => {
    const seasonClubs = mapFdTeamsResponse({
      competition: { id: 2000, code: 'WC' },
      season: WC_SEASON,
      teams: [
        {
          id: 790,
          name: 'Czechia',
          shortName: 'Czechia',
          tla: 'CZE',
          crest: 'https://crests.football-data.org/798.svg',
          area: { id: 2062, name: 'Czech Republic', code: 'CZE', flag: null },
          founded: 1901,
          venue: null,
          website: 'http://www.fotbal.cz',
          clubColors: 'Red / White / Blue',
        },
      ],
    });
    expect(seasonClubs.seasonExternalId).toBe('2398');
    expect(seasonClubs.clubs[0]).toMatchObject({
      externalId: '790',
      kind: ClubKind.NATIONAL,
      area: { code: 'CZE', name: 'Czech Republic' },
      founded: 1901,
      venueName: null,
      websiteUrl: 'http://www.fotbal.cz',
    });
  });

  it('таблиці: група-підпис → null, лише TOTAL/HOME/AWAY, порожні відкидаються', () => {
    const standings = mapFdStandingsResponse({
      season: { id: 2502, startDate: '2026-08-21', endDate: '2027-05-30' },
      standings: [
        {
          stage: 'REGULAR_SEASON',
          type: 'TOTAL',
          group: 'Matchday',
          table: [
            {
              position: 1,
              team: { id: 65, name: 'Manchester City FC', tla: 'MCI' },
              playedGames: 5,
              form: null,
              won: 5,
              draw: 0,
              lost: 0,
              points: 15,
              goalsFor: 13,
              goalsAgainst: 5,
              goalDifference: 8,
            },
          ],
        },
        { stage: 'REGULAR_SEASON', type: 'UNKNOWN_TYPE', table: [] },
        { stage: 'REGULAR_SEASON', type: 'HOME', table: [] },
      ],
    });
    expect(standings.seasonExternalId).toBe('2502');
    expect(standings.tables).toHaveLength(1);
    expect(standings.tables[0]).toMatchObject({
      stage: 'REGULAR_SEASON',
      groupName: null,
      type: StandingType.TOTAL,
    });
    expect(standings.tables[0].rows[0]).toMatchObject({
      position: 1,
      club: { externalId: '65' },
      played: 5,
      drawn: 0,
      goalDiff: 8,
      form: null,
    });
  });
});

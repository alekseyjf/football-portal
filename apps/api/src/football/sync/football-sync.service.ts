import { Injectable, Logger } from '@nestjs/common';
import {
  FOOTBALL_API_DELAY_MS,
  FOOTBALL_MATCH_PAGES_MAX,
  pauseMilliseconds,
  readConfiguredCompetitionIds,
} from '../football.constants';
import {
  clubSlugFromFd,
  FdCompetition,
  FdMatch,
  FdMatchesResponse,
  FdStandingsResponse,
  FdTeamsResponse,
  leagueSlugFromFd,
  mapMatchStatus,
  seasonLabelFromFd,
} from '../integration/football.mapper';
import { FootballDataClient } from '../integration/football-data.client';
import { FootballRepository } from '../persistence/football.repository';
import {
  buildLeagueTableCreateRows,
  pickStandingsTableRows,
} from '../football-standings.util';
import { FootballLiveThrottleService } from './football-live-throttle.service';

/**
 * Синхронізація з football-data.org та LIVE-оновлення.
 */
@Injectable()
export class FootballSyncService {
  private readonly log = new Logger(FootballSyncService.name);

  constructor(
    private readonly repo: FootballRepository,
    private readonly http: FootballDataClient,
    private readonly liveThrottle: FootballLiveThrottleService,
  ) {}

  getConfiguredCompetitionIds(): string[] {
    return readConfiguredCompetitionIds();
  }

  /**
   * HTTP 202: одразу відповідаємо клієнту, синк іде у фоні (без черги — див. README).
   */
  enqueueFullSync(competitionRefs: string[]): void {
    void this.runSequentialSync(competitionRefs).catch((error: unknown) => {
      this.log.error(`Фоновий синк football завершився помилкою: ${error}`);
    });
  }

  /** Для cron і внутрішніх викликів — чекаємо завершення. */
  async runSequentialSync(competitionRefs: string[]): Promise<void> {
    for (const ref of competitionRefs) {
      await this.syncSingleCompetition(ref);
    }
  }

  async syncSingleCompetition(competitionRef: string): Promise<{ ok: true }> {
    this.http.assertApiKeyConfigured();
    const encodedCompetitionRef = encodeURIComponent(competitionRef);
    const competition = await this.http.getJson<FdCompetition>(
      `/competitions/${encodedCompetitionRef}`,
    );
    await pauseMilliseconds(FOOTBALL_API_DELAY_MS);

    const country = competition.area?.name ?? '—';
    const season = seasonLabelFromFd(competition);
    const slug = leagueSlugFromFd(competition);
    const leagueRow = await this.repo.upsertLeague({
      externalId: competition.id,
      name: competition.name,
      slug,
      country,
      season,
      logoUrl: competition.emblem ?? null,
    });

    const teamsResponse = await this.http.getJson<FdTeamsResponse>(
      `/competitions/${encodedCompetitionRef}/teams`,
    );
    await pauseMilliseconds(FOOTBALL_API_DELAY_MS);

    const teams = teamsResponse.teams ?? [];
    const clubIdByExternalTeamId = new Map<number, string>();

    for (const team of teams) {
      const upsertedClub = await this.repo.upsertClub({
        externalId: team.id,
        name: team.name,
        slug: clubSlugFromFd(team),
        shortName: team.shortName ?? team.tla ?? null,
        logo: team.crest ?? null,
        founded: team.founded ?? null,
        venue: team.venue ?? null,
        leagueId: leagueRow.id,
      });
      clubIdByExternalTeamId.set(team.id, upsertedClub.id);
    }

    const seasonYear = competition.currentSeason?.startDate?.slice(0, 4);
    const matchesPath = seasonYear
      ? `/competitions/${encodedCompetitionRef}/matches?season=${seasonYear}`
      : `/competitions/${encodedCompetitionRef}/matches`;

    let offset = 0;
    const limit = 50;
    for (let page = 0; page < FOOTBALL_MATCH_PAGES_MAX; page += 1) {
      const sep = matchesPath.includes('?') ? '&' : '?';
      const pagePath = `${matchesPath}${sep}limit=${limit}&offset=${offset}`;
      const matchesResponse = await this.http.getJson<FdMatchesResponse>(pagePath);
      await pauseMilliseconds(FOOTBALL_API_DELAY_MS);

      const batch = matchesResponse.matches ?? [];
      for (const matchFromApi of batch) {
        await this.persistMatch(
          matchFromApi,
          leagueRow.id,
          clubIdByExternalTeamId,
        );
      }
      if (batch.length < limit) break;
      offset += limit;
    }

    const standingsPath = seasonYear
      ? `/competitions/${encodedCompetitionRef}/standings?season=${seasonYear}`
      : `/competitions/${encodedCompetitionRef}/standings`;
    const standingsResponse = await this.http.getJson<FdStandingsResponse>(
      standingsPath,
    );
    await pauseMilliseconds(FOOTBALL_API_DELAY_MS);

    const standingGroups = standingsResponse.standings ?? [];
    this.log.log(
      `[football standings] ${standingsPath} → груп: ${standingGroups.length} ` +
        (standingGroups.length
          ? `(${standingGroups
              .map(
                (group) =>
                  `${group.type ?? '?'}:${group.table?.length ?? 0}`,
              )
              .join(', ')})`
          : '(порожньо)'),
    );

    const { rows: totalTable, pickedType, usedFallback } =
      pickStandingsTableRows(standingGroups);
    if (usedFallback) {
      this.log.warn(
        `[football standings] TOTAL порожній, використано type=${pickedType ?? 'n/a'}`,
      );
    }

    const { rows: standingRows, skippedNoClub } = buildLeagueTableCreateRows(
      leagueRow.id,
      totalTable,
      clubIdByExternalTeamId,
    );

    if (standingRows.length > 0) {
      await this.repo.replaceLeagueStandings(leagueRow.id, standingRows);
      this.log.log(
        `[football standings] збережено рядків: ${standingRows.length}` +
          (skippedNoClub ? ` (пропущено без clubId: ${skippedNoClub})` : ''),
      );
    } else {
      this.log.warn(
        `[football standings] у БД не записано жодного рядка (рядків у відповіді: ${totalTable.length}, без clubId: ${skippedNoClub}).`,
      );
    }

    return { ok: true };
  }

  private async persistMatch(
    matchFromApi: FdMatch,
    leagueId: string,
    clubIdByExternalTeamId: Map<number, string>,
  ) {
    let homeClubId = clubIdByExternalTeamId.get(matchFromApi.homeTeam.id);
    let awayClubId = clubIdByExternalTeamId.get(matchFromApi.awayTeam.id);
    if (!homeClubId) {
      const upsertedClub = await this.repo.upsertClub({
        externalId: matchFromApi.homeTeam.id,
        name: matchFromApi.homeTeam.name,
        slug: clubSlugFromFd({
          id: matchFromApi.homeTeam.id,
          name: matchFromApi.homeTeam.name,
        }),
        shortName: null,
        logo: matchFromApi.homeTeam.crest ?? null,
        founded: null,
        venue: null,
        leagueId,
      });
      homeClubId = upsertedClub.id;
      clubIdByExternalTeamId.set(matchFromApi.homeTeam.id, homeClubId);
    }
    if (!awayClubId) {
      const upsertedClub = await this.repo.upsertClub({
        externalId: matchFromApi.awayTeam.id,
        name: matchFromApi.awayTeam.name,
        slug: clubSlugFromFd({
          id: matchFromApi.awayTeam.id,
          name: matchFromApi.awayTeam.name,
        }),
        shortName: null,
        logo: matchFromApi.awayTeam.crest ?? null,
        founded: null,
        venue: null,
        leagueId,
      });
      awayClubId = upsertedClub.id;
      clubIdByExternalTeamId.set(matchFromApi.awayTeam.id, awayClubId);
    }

    const fullTimeScore = matchFromApi.score?.fullTime;
    const homeScore =
      fullTimeScore?.home === null || fullTimeScore?.home === undefined
        ? null
        : fullTimeScore.home;
    const awayScore =
      fullTimeScore?.away === null || fullTimeScore?.away === undefined
        ? null
        : fullTimeScore.away;

    await this.repo.upsertMatch({
      externalId: matchFromApi.id,
      leagueId,
      homeClubId,
      awayClubId,
      date: new Date(matchFromApi.utcDate),
      status: mapMatchStatus(matchFromApi.status),
      minute: matchFromApi.minute ?? null,
      matchday: matchFromApi.matchday ?? null,
      homeScore,
      awayScore,
    });
  }

  async syncLiveForCompetition(ref: string | number): Promise<void> {
    if (!this.http.hasApiKey()) return;

    const encodedCompetitionRef = encodeURIComponent(String(ref));
    const competition = await this.http.getJson<FdCompetition>(
      `/competitions/${encodedCompetitionRef}`,
    );
    await pauseMilliseconds(FOOTBALL_API_DELAY_MS);

    const leagueRecord = await this.repo.findLeagueBySlug(
      leagueSlugFromFd(competition),
    );
    if (!leagueRecord) return;

    const liveMatchesResponse = await this.http.getJson<FdMatchesResponse>(
      `/competitions/${encodedCompetitionRef}/matches?status=LIVE`,
    );
    await pauseMilliseconds(FOOTBALL_API_DELAY_MS);

    const clubIdByExternalTeamId = new Map<number, string>();
    for (const matchFromApi of liveMatchesResponse.matches ?? []) {
      await this.persistMatch(
        matchFromApi,
        leagueRecord.id,
        clubIdByExternalTeamId,
      );
    }
  }

  async requestLiveSyncForMatch(matchId: string): Promise<{
    accepted: boolean;
    skipped?: 'not_found' | 'not_live' | 'throttled' | 'no_api_key';
  }> {
    if (!this.http.hasApiKey()) {
      return { accepted: false, skipped: 'no_api_key' };
    }
    const matchLiveContext = await this.repo.findMatchLiveContext(matchId);
    if (!matchLiveContext) return { accepted: false, skipped: 'not_found' };
    if (matchLiveContext.status !== 'LIVE') {
      return { accepted: false, skipped: 'not_live' };
    }
    const competitionExternalId = matchLiveContext.league.externalId;
    const now = Date.now();
    if (this.liveThrottle.isThrottled(competitionExternalId, now)) {
      return { accepted: false, skipped: 'throttled' };
    }
    this.liveThrottle.mark(competitionExternalId, now);
    void this.syncLiveForCompetition(competitionExternalId).catch(
      (error: unknown) => {
        this.log.warn(`on-demand LIVE sync failed: ${error}`);
      },
    );
    return { accepted: true };
  }

  async syncLiveMatchesOnly(): Promise<void> {
    if (!this.http.hasApiKey()) return;
    for (const ref of readConfiguredCompetitionIds()) {
      await this.syncLiveForCompetition(ref);
    }
  }
}

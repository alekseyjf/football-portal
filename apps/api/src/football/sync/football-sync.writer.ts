import { Inject, Injectable, Logger } from '@nestjs/common';
import { MatchStatus, type ClubKind } from '@prisma/client';
import {
  isTransientTransactionError,
  isUniqueViolationOn,
} from '../../prisma/prisma-errors';
import { MATCH_WRITE_CHUNK_SIZE } from '../football.constants';
import {
  FOOTBALL_PROVIDER,
  FootballProviderError,
  type FootballProvider,
  type ProviderClub,
  type ProviderClubRef,
  type ProviderCompetition,
  type ProviderMatch,
  type ProviderSeason,
  type ProviderStandingTable,
} from '../integration/football-provider.port';
import {
  ExternalRefRepository,
  type ExternalRefState,
} from '../persistence/external-ref.repository';
import {
  FootballSyncRepository,
  type ClubProviderFields,
  type MatchChunkWrite,
  type MatchCreateTarget,
  type MatchProviderFields,
  type MatchUpdateRecord,
  type NewMatchRecord,
  type StandingRowRecord,
} from '../persistence/football-sync.repository';
import { pickClubSlug, slugifyClubName } from './football-club-slug';
import { payloadHashOf } from './football-payload-hash';
import { describeSyncError, type SyncStats } from './football-sync-stats';

/** Паралельний синк створив той самий клуб → повторний resolve (P5-4). */
const CLUB_CREATE_ATTEMPTS = 3;
/** Чанк матчів / таблиця: другий шанс — лише для deadlock-у (транзакцію відкочено цілком). */
const WRITE_ATTEMPTS = 2;

/** Клуб до створення: `areaCode` — для slug-а, `payloadHash: null` — неповні дані. */
type ClubCandidate = {
  externalId: string;
  areaCode: string | null;
  payloadHash: string | null;
  fields: ClubProviderFields;
};

type MatchWriteOperation =
  | { kind: 'create'; record: NewMatchRecord }
  | { kind: 'update'; record: MatchUpdateRecord; becameFinished: boolean }
  | { kind: 'unchanged'; externalId: string };

function uniqueByExternalId<Entity extends { externalId: string }>(
  entities: Entity[],
): Entity[] {
  return [
    ...new Map(entities.map((entity) => [entity.externalId, entity])).values(),
  ];
}

function isClubCreateConflict(error: unknown): boolean {
  return (
    isUniqueViolationOn(error, 'Club') ||
    isUniqueViolationOn(error, 'ClubExternalRef') ||
    isTransientTransactionError(error)
  );
}

function utcDate(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

function toMatchFields(
  providerMatch: ProviderMatch,
  homeClubId: string,
  awayClubId: string,
): MatchProviderFields {
  return {
    stage: providerMatch.stage,
    groupName: providerMatch.groupName,
    matchday: providerMatch.matchday,
    kickoffAt: providerMatch.kickoffAt,
    status: providerMatch.status,
    minute: providerMatch.minute,
    homeClubId,
    awayClubId,
    homeScore: providerMatch.score.home,
    awayScore: providerMatch.score.away,
    homeScoreHalfTime: providerMatch.score.homeHalfTime,
    awayScoreHalfTime: providerMatch.score.awayHalfTime,
    homePenalties: providerMatch.score.homePenalties,
    awayPenalties: providerMatch.score.awayPenalties,
    winner: providerMatch.winner,
    venueName: providerMatch.venueName,
  };
}

/**
 * Кроки синку, спільні для повного і LIVE-синку: провайдерські дані → доменні таблиці +
 * `*ExternalRef`. Працює лише з нейтральними `Provider*` (6.2 п. 1).
 */
@Injectable()
export class FootballSyncWriter {
  private readonly log = new Logger(FootballSyncWriter.name);

  constructor(
    @Inject(FOOTBALL_PROVIDER) private readonly provider: FootballProvider,
    private readonly syncRepository: FootballSyncRepository,
    private readonly externalRefs: ExternalRefRepository,
  ) {}

  // ─── Турнір і сезон (лише повний синк) ───

  async applyCompetition(
    competitionId: string,
    providerCompetition: ProviderCompetition,
    syncedAt: Date,
  ): Promise<void> {
    const area = providerCompetition.area;
    const areaIdByCode = await this.syncRepository.ensureAreas(
      area ? [area] : [],
    );
    const payloadHash = payloadHashOf({
      name: providerCompetition.name,
      emblemUrl: providerCompetition.emblemUrl,
      areaCode: area?.code ?? null,
    });
    const competitionRef = await this.externalRefs.findCompetitionRef(
      this.provider.provider,
      competitionId,
    );
    if (competitionRef?.payloadHash === payloadHash) {
      await this.syncRepository.touchCompetitionRef(
        competitionId,
        this.provider.provider,
        syncedAt,
      );
      return;
    }
    await this.syncRepository.updateCompetition(
      competitionId,
      {
        name: providerCompetition.name,
        emblemUrl: providerCompetition.emblemUrl,
        areaId: area ? (areaIdByCode.get(area.code) ?? null) : null,
      },
      this.provider.provider,
      payloadHash,
      syncedAt,
    );
  }

  /** Сезон провайдера → наш `Season` + перехід `isCurrent` (6.2 п. 8, P5-8). → seasonId */
  async applyCurrentSeason(
    competitionId: string,
    providerSeason: ProviderSeason,
    stats: SyncStats,
    syncedAt: Date,
  ): Promise<string> {
    const seasonFields = {
      startDate: utcDate(providerSeason.startDate),
      endDate: utcDate(providerSeason.endDate),
      currentMatchday: providerSeason.currentMatchday,
    };
    const seasonRef = {
      provider: this.provider.provider,
      externalId: providerSeason.externalId,
      payloadHash: payloadHashOf(providerSeason),
    };
    const knownSeason = await this.externalRefs.resolveSeason(
      this.provider.provider,
      providerSeason.externalId,
    );

    let seasonId: string;
    if (knownSeason) {
      seasonId = knownSeason.entityId;
      if (knownSeason.payloadHash !== seasonRef.payloadHash) {
        await this.syncRepository.updateSeason(
          seasonId,
          seasonFields,
          seasonRef,
          syncedAt,
        );
      }
    } else {
      const seasonWithSameLabel = await this.syncRepository.findSeasonByLabel(
        competitionId,
        providerSeason.label,
        this.provider.provider,
      );
      if (seasonWithSameLabel?.externalId) {
        // Label уже зайнятий іншим сезоном провайдера: злиття двох сезонів в один `Season`
        // змішало б матчі й таблиці — синк зупиняється з причиною в журналі
        throw new FootballProviderError(
          'INVALID_RESPONSE',
          `сезон ${providerSeason.label} уже прив'язаний до id ${seasonWithSameLabel.externalId}, провайдер повернув ${providerSeason.externalId}`,
        );
      }
      if (seasonWithSameLabel) {
        seasonId = seasonWithSameLabel.id;
        await this.syncRepository.attachSeasonRef(
          seasonId,
          seasonFields,
          seasonRef,
          syncedAt,
        );
      } else {
        seasonId = await this.syncRepository.createSeason(
          competitionId,
          providerSeason.label,
          seasonFields,
          seasonRef,
          syncedAt,
        );
      }
    }

    stats.seasonLabel = providerSeason.label;
    stats.seasonChanged = await this.syncRepository.makeSeasonCurrent(
      competitionId,
      seasonId,
    );
    return seasonId;
  }

  // ─── Клуби ───

  /**
   * Повні дані клубів (склад турніру): створити відсутні, оновити змінені за хешем (P5-4).
   * → externalId → clubId для всіх клубів складу.
   */
  async applySeasonClubs(
    providerClubs: ProviderClub[],
    stats: SyncStats,
    syncedAt: Date,
  ): Promise<Map<string, string>> {
    const clubs = uniqueByExternalId(providerClubs);
    const areaIdByCode = await this.syncRepository.ensureAreas(
      clubs.flatMap((club) => (club.area ? [club.area] : [])),
    );
    const candidateByExternalId = new Map(
      clubs.map((club) => [
        club.externalId,
        {
          externalId: club.externalId,
          areaCode: club.area?.code ?? null,
          payloadHash: payloadHashOf(club),
          fields: {
            name: club.name,
            shortName: club.shortName,
            tla: club.tla,
            kind: club.kind,
            areaId: club.area
              ? (areaIdByCode.get(club.area.code) ?? null)
              : null,
            crestUrl: club.crestUrl,
            founded: club.founded,
            venueName: club.venueName,
            websiteUrl: club.websiteUrl,
            clubColors: club.clubColors,
          },
        } satisfies ClubCandidate,
      ]),
    );

    const clubIdByExternalId = new Map<string, string>();
    const knownRefs = await this.externalRefs.resolveClubs(
      this.provider.provider,
      [...candidateByExternalId.keys()],
    );
    const missingCandidates = [...candidateByExternalId.values()].filter(
      (candidate) => !knownRefs.has(candidate.externalId),
    );
    const refsCreatedElsewhere = await this.createClubsResilient(
      missingCandidates,
      clubIdByExternalId,
      stats,
      syncedAt,
    );

    // Наявні (і створені паралельним синком, можливо з неповних даних) — оновити за хешем
    const unchangedExternalIds: string[] = [];
    const existingRefs = [...knownRefs, ...refsCreatedElsewhere].sort(
      ([, leftRef], [, rightRef]) =>
        leftRef.entityId < rightRef.entityId ? -1 : 1,
    );
    for (const [externalId, clubRef] of existingRefs) {
      clubIdByExternalId.set(externalId, clubRef.entityId);
      const candidate = candidateByExternalId.get(externalId)!;
      if (clubRef.payloadHash === candidate.payloadHash) {
        unchangedExternalIds.push(externalId);
        continue;
      }
      await this.syncRepository.updateClub(
        clubRef.entityId,
        candidate.fields,
        {
          provider: this.provider.provider,
          externalId,
          payloadHash: candidate.payloadHash,
        },
        syncedAt,
      );
      stats.clubsUpdated += 1;
    }
    await this.externalRefs.touchClubs(
      this.provider.provider,
      unchangedExternalIds,
      syncedAt,
    );
    return clubIdByExternalId;
  }

  /**
   * Клуби, відомі лише з матчу / таблиці (немає в складі): створити з неповних даних,
   * наявні — не чіпати (P5-4). Доповнює `clubIdByExternalId`.
   */
  async ensureClubsExist(
    clubRefs: ProviderClubRef[],
    participantKind: ClubKind,
    clubIdByExternalId: Map<string, string>,
    stats: SyncStats,
    syncedAt: Date,
  ): Promise<void> {
    const unresolvedRefs = uniqueByExternalId(clubRefs).filter(
      (clubRef) => !clubIdByExternalId.has(clubRef.externalId),
    );
    if (unresolvedRefs.length === 0) return;
    const knownRefs = await this.externalRefs.resolveClubs(
      this.provider.provider,
      unresolvedRefs.map((clubRef) => clubRef.externalId),
    );
    for (const [externalId, clubRef] of knownRefs) {
      clubIdByExternalId.set(externalId, clubRef.entityId);
    }
    const missingCandidates: ClubCandidate[] = unresolvedRefs
      .filter((clubRef) => !knownRefs.has(clubRef.externalId))
      .map((clubRef) => ({
        externalId: clubRef.externalId,
        areaCode: null,
        payloadHash: null,
        fields: {
          name: clubRef.name,
          shortName: clubRef.shortName,
          tla: clubRef.tla,
          kind: participantKind,
          areaId: null,
          crestUrl: clubRef.crestUrl,
          founded: null,
          venueName: null,
          websiteUrl: null,
          clubColors: null,
        },
      }));
    const refsCreatedElsewhere = await this.createClubsResilient(
      missingCandidates,
      clubIdByExternalId,
      stats,
      syncedAt,
    );
    for (const [externalId, clubRef] of refsCreatedElsewhere) {
      clubIdByExternalId.set(externalId, clubRef.entityId);
    }
  }

  /** LIVE: лише наявні клуби, без створення (створює повний синк під локом, P5-11). */
  async resolveKnownClubs(
    clubRefs: ProviderClubRef[],
  ): Promise<Map<string, string>> {
    const knownRefs = await this.externalRefs.resolveClubs(
      this.provider.provider,
      uniqueByExternalId(clubRefs).map((clubRef) => clubRef.externalId),
    );
    return new Map(
      [...knownRefs].map(([externalId, clubRef]) => [
        externalId,
        clubRef.entityId,
      ]),
    );
  }

  /**
   * Створює клуби однією транзакцією; конфлікт із паралельним синком (P2002 / deadlock) →
   * транзакцію відкочено, повторний resolve, створюємо лише решту (P5-4).
   * → посилання на клуби, які тим часом створив хтось інший.
   */
  private async createClubsResilient(
    candidates: ClubCandidate[],
    clubIdByExternalId: Map<string, string>,
    stats: SyncStats,
    syncedAt: Date,
  ): Promise<Map<string, ExternalRefState>> {
    const refsCreatedElsewhere = new Map<string, ExternalRefState>();
    let pendingCandidates = candidates;
    for (let attempt = 1; pendingCandidates.length > 0; attempt += 1) {
      const takenSlugs = await this.syncRepository.findTakenClubSlugs([
        ...new Set(
          pendingCandidates.map((candidate) =>
            slugifyClubName(candidate.fields.name),
          ),
        ),
      ]);
      const newClubs = pendingCandidates.map((candidate) => {
        const slug = pickClubSlug(
          candidate.fields.name,
          candidate.areaCode,
          takenSlugs,
        );
        takenSlugs.add(slug);
        return {
          externalId: candidate.externalId,
          slug,
          payloadHash: candidate.payloadHash,
          fields: candidate.fields,
        };
      });
      try {
        const createdClubIds = await this.syncRepository.createClubs(
          this.provider.provider,
          newClubs,
          syncedAt,
        );
        for (const [externalId, clubId] of createdClubIds) {
          clubIdByExternalId.set(externalId, clubId);
        }
        stats.clubsCreated += createdClubIds.size;
        return refsCreatedElsewhere;
      } catch (error) {
        if (attempt >= CLUB_CREATE_ATTEMPTS || !isClubCreateConflict(error)) {
          throw error;
        }
        const refsFoundNow = await this.externalRefs.resolveClubs(
          this.provider.provider,
          pendingCandidates.map((candidate) => candidate.externalId),
        );
        for (const [externalId, clubRef] of refsFoundNow) {
          refsCreatedElsewhere.set(externalId, clubRef);
        }
        pendingCandidates = pendingCandidates.filter(
          (candidate) => !refsFoundNow.has(candidate.externalId),
        );
      }
    }
    return refsCreatedElsewhere;
  }

  // ─── Матчі ───

  /**
   * Матчі чанками по `MATCH_WRITE_CHUNK_SIZE` (6.2 п. 5, P5-7): без змін — пропуск за хешем;
   * чанк, що впав, не зупиняє решту (`matchesFailed` → `PARTIAL`).
   * → кількість матчів, що цим записом стали `FINISHED` (LIVE оновлює таблицю).
   */
  async applyMatches(
    providerMatches: ProviderMatch[],
    clubIdByExternalId: Map<string, string>,
    createTarget: MatchCreateTarget | null,
    stats: SyncStats,
    syncedAt: Date,
  ): Promise<{ finishedNowCount: number }> {
    const writableMatches: {
      externalId: string;
      payloadHash: string;
      fields: MatchProviderFields;
    }[] = [];
    for (const providerMatch of uniqueByExternalId(providerMatches)) {
      if (!providerMatch.homeClub || !providerMatch.awayClub) {
        stats.matchesUndecided += 1;
        continue;
      }
      const homeClubId = clubIdByExternalId.get(
        providerMatch.homeClub.externalId,
      );
      const awayClubId = clubIdByExternalId.get(
        providerMatch.awayClub.externalId,
      );
      if (!homeClubId || !awayClubId) {
        stats.matchesUnknown += 1;
        continue;
      }
      if (homeClubId === awayClubId) {
        stats.matchesUndecided += 1;
        continue;
      }
      const fields = toMatchFields(providerMatch, homeClubId, awayClubId);
      writableMatches.push({
        externalId: providerMatch.externalId,
        payloadHash: payloadHashOf(fields),
        fields,
      });
    }

    const knownMatches = await this.externalRefs.resolveMatches(
      this.provider.provider,
      writableMatches.map((writableMatch) => writableMatch.externalId),
    );
    const operations: MatchWriteOperation[] = [];
    for (const writableMatch of writableMatches) {
      const knownMatch = knownMatches.get(writableMatch.externalId);
      if (!knownMatch) {
        if (createTarget) {
          operations.push({ kind: 'create', record: writableMatch });
        } else {
          stats.matchesUnknown += 1;
        }
      } else if (knownMatch.payloadHash === writableMatch.payloadHash) {
        operations.push({
          kind: 'unchanged',
          externalId: writableMatch.externalId,
        });
      } else {
        operations.push({
          kind: 'update',
          record: { ...writableMatch, matchId: knownMatch.entityId },
          becameFinished:
            knownMatch.status !== MatchStatus.FINISHED &&
            writableMatch.fields.status === MatchStatus.FINISHED,
        });
      }
    }

    let finishedNowCount = 0;
    for (
      let chunkStart = 0;
      chunkStart < operations.length;
      chunkStart += MATCH_WRITE_CHUNK_SIZE
    ) {
      const chunkOperations = operations.slice(
        chunkStart,
        chunkStart + MATCH_WRITE_CHUNK_SIZE,
      );
      const chunk: MatchChunkWrite = {
        createTarget,
        creates: [],
        updates: [],
        unchangedExternalIds: [],
      };
      let chunkFinishedCount = 0;
      for (const operation of chunkOperations) {
        if (operation.kind === 'create') chunk.creates.push(operation.record);
        if (operation.kind === 'update') {
          chunk.updates.push(operation.record);
          if (operation.becameFinished) chunkFinishedCount += 1;
        }
        if (operation.kind === 'unchanged') {
          chunk.unchangedExternalIds.push(operation.externalId);
        }
      }
      const isWritten = await this.withWriteRetry(
        `матчі ${chunkStart + 1}–${chunkStart + chunkOperations.length}`,
        () =>
          this.syncRepository.writeMatchChunk(
            this.provider.provider,
            chunk,
            syncedAt,
          ),
      );
      if (isWritten) {
        stats.matchesCreated += chunk.creates.length;
        stats.matchesUpdated += chunk.updates.length;
        stats.matchesSkipped += chunk.unchangedExternalIds.length;
        finishedNowCount += chunkFinishedCount;
      } else {
        stats.matchesFailed += chunk.creates.length + chunk.updates.length;
      }
    }
    return { finishedNowCount };
  }

  // ─── Таблиці ───

  /**
   * Кожна таблиця — атомарно й окремо (6.2 п. 6, P5-9). Таблиця з клубом, якого немає в БД,
   * не пишеться зовсім: неповна таблиця гірша за вчорашню.
   */
  async applyStandings(
    seasonId: string,
    tables: ProviderStandingTable[],
    clubIdByExternalId: Map<string, string>,
    stats: SyncStats,
  ): Promise<void> {
    for (const table of tables) {
      const tableName = `${table.stage}/${table.groupName ?? '-'}/${table.type}`;
      const rowByClubId = new Map<string, StandingRowRecord>();
      let hasUnknownClub = false;
      for (const providerRow of table.rows) {
        const clubId = clubIdByExternalId.get(providerRow.club.externalId);
        if (!clubId) {
          hasUnknownClub = true;
          break;
        }
        if (rowByClubId.has(clubId)) continue;
        rowByClubId.set(clubId, {
          clubId,
          position: providerRow.position,
          played: providerRow.played,
          won: providerRow.won,
          drawn: providerRow.drawn,
          lost: providerRow.lost,
          points: providerRow.points,
          goalsFor: providerRow.goalsFor,
          goalsAgainst: providerRow.goalsAgainst,
          goalDiff: providerRow.goalDiff,
          form: providerRow.form,
        });
      }
      if (hasUnknownClub) {
        this.log.warn(
          `Таблиця ${tableName}: клуб не знайдено в БД — пропущено`,
        );
        stats.standingsFailed += 1;
        continue;
      }
      const rows = [...rowByClubId.values()];
      const isWritten = await this.withWriteRetry(`таблиця ${tableName}`, () =>
        this.syncRepository.replaceStandingTable(
          seasonId,
          {
            stage: table.stage,
            groupName: table.groupName ?? '',
            type: table.type,
          },
          rows,
        ),
      );
      if (isWritten) {
        stats.standingsTables += 1;
        stats.standingsRows += rows.length;
      } else {
        stats.standingsFailed += 1;
      }
    }
  }

  /** Deadlock — один повтор (транзакцію відкочено цілком); інша помилка — запис пропущено. */
  private async withWriteRetry(
    writeName: string,
    write: () => Promise<void>,
  ): Promise<boolean> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await write();
        return true;
      } catch (error) {
        if (attempt < WRITE_ATTEMPTS && isTransientTransactionError(error)) {
          continue;
        }
        this.log.warn(
          `Не записано (${writeName}): ${describeSyncError(error)}`,
        );
        return false;
      }
    }
  }
}

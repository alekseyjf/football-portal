import { Injectable } from '@nestjs/common';
import {
  MatchStatus,
  type ClubKind,
  type DataProvider,
  type MatchWinner,
  type StandingType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SYNC_TRANSACTION_MAX_WAIT_MS,
  SYNC_TRANSACTION_TIMEOUT_MS,
} from '../football.constants';
import {
  LIVE_SYNC_MATCH_STATUSES,
  liveWindowBounds,
} from '../football-match-status';
import type { ProviderArea } from '../integration/football-provider.port';

const SYNC_TRANSACTION_OPTIONS = {
  timeout: SYNC_TRANSACTION_TIMEOUT_MS,
  maxWait: SYNC_TRANSACTION_MAX_WAIT_MS,
};

/** Турнір, який можна синкати: має посилання на провайдера. */
export type SyncTargetCompetition = {
  id: string;
  slug: string;
  externalId: string;
};

export type CompetitionForSync = {
  id: string;
  slug: string;
  /** `null` — у турніру немає посилання на цього провайдера */
  externalId: string | null;
};

export type SeasonProviderFields = {
  startDate: Date;
  endDate: Date;
  currentMatchday: number | null;
};

export type CurrentSeasonForSync = SeasonProviderFields & {
  id: string;
  label: string;
  externalId: string | null;
};

/** Provider-owned поля клубу (6.2 п. 3): `slug` сюди не входить — він editorial. */
export type ClubProviderFields = {
  name: string;
  shortName: string | null;
  tla: string | null;
  kind: ClubKind;
  areaId: string | null;
  crestUrl: string | null;
  founded: number | null;
  venueName: string | null;
  websiteUrl: string | null;
  clubColors: string | null;
};

export type NewClubRecord = {
  externalId: string;
  slug: string;
  /** `null` — неповні дані (клуб з матчу / таблиці): перший повний payload запишеться (P5-4) */
  payloadHash: string | null;
  fields: ClubProviderFields;
};

/**
 * Provider-owned поля матчу. Явний тип: `likeCount` / `dislikeCount` (лайки) і
 * `competitionId` / `seasonId` (ідентичність) синк не пише ніколи (P5-7, 5.0 п. 5).
 */
export type MatchProviderFields = {
  stage: string;
  groupName: string | null;
  matchday: number | null;
  kickoffAt: Date;
  status: MatchStatus;
  minute: number | null;
  homeClubId: string;
  awayClubId: string;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreHalfTime: number | null;
  awayScoreHalfTime: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  winner: MatchWinner | null;
  venueName: string | null;
};

export type NewMatchRecord = {
  externalId: string;
  payloadHash: string;
  fields: MatchProviderFields;
};

export type MatchUpdateRecord = NewMatchRecord & { matchId: string };

/** Куди створювати нові матчі; `null` — LIVE-синк, лише оновлення наявних (P5-11). */
export type MatchCreateTarget = { competitionId: string; seasonId: string };

export type MatchChunkWrite = {
  createTarget: MatchCreateTarget | null;
  creates: NewMatchRecord[];
  updates: MatchUpdateRecord[];
  /** Побачені без змін — лише `lastSyncedAt` */
  unchangedExternalIds: string[];
};

export type StandingTableKey = {
  stage: string;
  /** `''` замість `NULL` — інакше `@@unique` не спрацює */
  groupName: string;
  type: StandingType;
};

export type StandingRowRecord = {
  clubId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: string | null;
};

/**
 * Записи синку в доменні таблиці. Жодного голого `upsert` на спільних сутностях (5.0 п. 1):
 * у Prisma 7 з driver adapter це SELECT + INSERT, паралельні синки ловлять P2002.
 */
@Injectable()
export class FootballSyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Турніри ───

  /** Без `slugs` — активні (D7); зі `slugs` — будь-які наявні (явна дія адміна, P5-13). */
  async findCompetitionsForSync(
    provider: DataProvider,
    slugs?: string[],
  ): Promise<CompetitionForSync[]> {
    const competitions = await this.prisma.competition.findMany({
      where: slugs ? { slug: { in: slugs } } : { isActive: true },
      select: {
        id: true,
        slug: true,
        externalRefs: { where: { provider }, select: { externalId: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    });
    return competitions.map((competition) => ({
      id: competition.id,
      slug: competition.slug,
      externalId: competition.externalRefs[0]?.externalId ?? null,
    }));
  }

  /** Активні турніри, де є матч у LIVE-вікні (P5-11) — для LIVE-cron. */
  async findCompetitionsInLiveWindow(
    provider: DataProvider,
    now: Date,
  ): Promise<SyncTargetCompetition[]> {
    const bounds = liveWindowBounds(now);
    const competitions = await this.prisma.competition.findMany({
      where: {
        isActive: true,
        externalRefs: { some: { provider } },
        matches: {
          some: {
            OR: [
              {
                status: { in: [...LIVE_SYNC_MATCH_STATUSES] },
                kickoffAt: { gte: bounds.inPlayKickoffFrom },
              },
              {
                status: MatchStatus.SCHEDULED,
                kickoffAt: {
                  gte: bounds.scheduledKickoffFrom,
                  lte: bounds.scheduledKickoffTo,
                },
              },
            ],
          },
        },
      },
      select: {
        id: true,
        slug: true,
        externalRefs: { where: { provider }, select: { externalId: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    });
    return competitions.map((competition) => ({
      id: competition.id,
      slug: competition.slug,
      externalId: competition.externalRefs[0].externalId,
    }));
  }

  async findMatchLiveContext(matchId: string, provider: DataProvider) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        status: true,
        kickoffAt: true,
        competition: {
          select: {
            id: true,
            slug: true,
            externalRefs: { where: { provider }, select: { externalId: true } },
          },
        },
      },
    });
    if (!match) return null;
    const externalId = match.competition.externalRefs[0]?.externalId ?? null;
    return {
      status: match.status,
      kickoffAt: match.kickoffAt,
      competition: externalId
        ? { id: match.competition.id, slug: match.competition.slug, externalId }
        : null,
    };
  }

  /** Provider-owned поля турніру; `slug`, `type`, `isActive`, `sortOrder` — editorial (6.2 п. 3). */
  async updateCompetition(
    competitionId: string,
    fields: { name: string; emblemUrl: string | null; areaId: string | null },
    provider: DataProvider,
    payloadHash: string,
    syncedAt: Date,
  ): Promise<void> {
    await this.prisma.competition.update({
      where: { id: competitionId },
      data: {
        ...fields,
        externalRefs: {
          update: {
            where: { provider_competitionId: { provider, competitionId } },
            data: { payloadHash, lastSyncedAt: syncedAt },
          },
        },
      },
      select: { id: true },
    });
  }

  async touchCompetitionRef(
    competitionId: string,
    provider: DataProvider,
    syncedAt: Date,
  ): Promise<void> {
    await this.prisma.competitionExternalRef.updateMany({
      where: { provider, competitionId },
      data: { lastSyncedAt: syncedAt },
    });
  }

  // ─── Area ───

  /**
   * Area за кодом: `createMany skipDuplicates` (`ON CONFLICT DO NOTHING`) + дочитування —
   * паралельні синки з тією самою країною не ловлять P2002. → code → id.
   */
  async ensureAreas(areas: ProviderArea[]): Promise<Map<string, string>> {
    const providedAreaByCode = new Map(areas.map((area) => [area.code, area]));
    if (providedAreaByCode.size === 0) return new Map();
    await this.prisma.area.createMany({
      data: [...providedAreaByCode.values()],
      skipDuplicates: true,
    });
    const storedAreas = await this.prisma.area.findMany({
      where: { code: { in: [...providedAreaByCode.keys()] } },
      select: { id: true, code: true, name: true, flagUrl: true },
    });
    for (const storedArea of storedAreas) {
      const providedArea = providedAreaByCode.get(storedArea.code)!;
      if (
        storedArea.name !== providedArea.name ||
        storedArea.flagUrl !== providedArea.flagUrl
      ) {
        await this.prisma.area.update({
          where: { id: storedArea.id },
          data: { name: providedArea.name, flagUrl: providedArea.flagUrl },
          select: { id: true },
        });
      }
    }
    return new Map(storedAreas.map((area) => [area.code, area.id]));
  }

  // ─── Season (пише лише повний синк під своїм локом) ───

  /** Сезон за label + id цього провайдера в ньому (`externalId: null` — посилання немає). */
  async findSeasonByLabel(
    competitionId: string,
    label: string,
    provider: DataProvider,
  ): Promise<{ id: string; externalId: string | null } | null> {
    const season = await this.prisma.season.findUnique({
      where: { competitionId_label: { competitionId, label } },
      select: {
        id: true,
        externalRefs: { where: { provider }, select: { externalId: true } },
      },
    });
    if (!season) return null;
    return {
      id: season.id,
      externalId: season.externalRefs[0]?.externalId ?? null,
    };
  }

  async createSeason(
    competitionId: string,
    label: string,
    fields: SeasonProviderFields,
    ref: { provider: DataProvider; externalId: string; payloadHash: string },
    syncedAt: Date,
  ): Promise<string> {
    const season = await this.prisma.season.create({
      data: {
        competitionId,
        label,
        ...fields,
        externalRefs: { create: { ...ref, lastSyncedAt: syncedAt } },
      },
      select: { id: true },
    });
    return season.id;
  }

  /** Сезон уже є (за label), але без посилання на цього провайдера. */
  async attachSeasonRef(
    seasonId: string,
    fields: SeasonProviderFields,
    ref: { provider: DataProvider; externalId: string; payloadHash: string },
    syncedAt: Date,
  ): Promise<void> {
    await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        ...fields,
        externalRefs: { create: { ...ref, lastSyncedAt: syncedAt } },
      },
      select: { id: true },
    });
  }

  /** `label` не оновлюється: він у URL (`?season=2025-26`, P5-8). */
  async updateSeason(
    seasonId: string,
    fields: SeasonProviderFields,
    ref: { provider: DataProvider; externalId: string; payloadHash: string },
    syncedAt: Date,
  ): Promise<void> {
    await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        ...fields,
        externalRefs: {
          update: {
            where: {
              provider_externalId: {
                provider: ref.provider,
                externalId: ref.externalId,
              },
            },
            data: { payloadHash: ref.payloadHash, lastSyncedAt: syncedAt },
          },
        },
      },
      select: { id: true },
    });
  }

  /**
   * Перехід сезону (6.2 п. 8): в одній транзакції зняти `isCurrent` зі старого й поставити
   * новому — partial unique `Season_single_current_idx` не дасть двох поточних.
   * → `true`, якщо поточний сезон змінився.
   */
  async makeSeasonCurrent(
    competitionId: string,
    seasonId: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const alreadyCurrent = await tx.season.findFirst({
        where: { id: seasonId, isCurrent: true },
        select: { id: true },
      });
      if (alreadyCurrent) return false;
      await tx.season.updateMany({
        where: { competitionId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.season.update({
        where: { id: seasonId },
        data: { isCurrent: true },
        select: { id: true },
      });
      return true;
    });
  }

  async findCurrentSeasonForSync(
    competitionId: string,
    provider: DataProvider,
  ): Promise<CurrentSeasonForSync | null> {
    const season = await this.prisma.season.findFirst({
      where: { competitionId, isCurrent: true },
      select: {
        id: true,
        label: true,
        startDate: true,
        endDate: true,
        currentMatchday: true,
        externalRefs: { where: { provider }, select: { externalId: true } },
      },
    });
    if (!season) return null;
    const { externalRefs, ...seasonFields } = season;
    return { ...seasonFields, externalId: externalRefs[0]?.externalId ?? null };
  }

  // ─── Club ───

  /** Зайняті slug-и з тими самими початками — для `pickClubSlug` (P5-5). */
  async findTakenClubSlugs(baseSlugs: string[]): Promise<Set<string>> {
    if (baseSlugs.length === 0) return new Set();
    const clubs = await this.prisma.club.findMany({
      where: {
        OR: baseSlugs.map((baseSlug) => ({ slug: { startsWith: baseSlug } })),
      },
      select: { slug: true },
    });
    return new Set(clubs.map((club) => club.slug));
  }

  /**
   * Клуби з посиланнями — однією транзакцією, у порядку `externalId` (P5-4). Паралельний синк
   * створив той самий клуб → P2002 (`ClubExternalRef` / `Club.slug`) → відкат усієї транзакції:
   * «сиріт» `Club` без посилання не лишається, сервіс робить повторний resolve.
   */
  async createClubs(
    provider: DataProvider,
    newClubs: NewClubRecord[],
    syncedAt: Date,
  ): Promise<Map<string, string>> {
    const sortedClubs = [...newClubs].sort((left, right) =>
      left.externalId < right.externalId ? -1 : 1,
    );
    return this.prisma.$transaction(async (tx) => {
      const clubIdByExternalId = new Map<string, string>();
      for (const newClub of sortedClubs) {
        const createdClub = await tx.club.create({
          data: {
            slug: newClub.slug,
            ...newClub.fields,
            externalRefs: {
              create: {
                provider,
                externalId: newClub.externalId,
                payloadHash: newClub.payloadHash,
                lastSyncedAt: syncedAt,
              },
            },
          },
          select: { id: true },
        });
        clubIdByExternalId.set(newClub.externalId, createdClub.id);
      }
      return clubIdByExternalId;
    }, SYNC_TRANSACTION_OPTIONS);
  }

  async updateClub(
    clubId: string,
    fields: ClubProviderFields,
    ref: { provider: DataProvider; externalId: string; payloadHash: string },
    syncedAt: Date,
  ): Promise<void> {
    await this.prisma.club.update({
      where: { id: clubId },
      data: {
        ...fields,
        externalRefs: {
          update: {
            where: {
              provider_externalId: {
                provider: ref.provider,
                externalId: ref.externalId,
              },
            },
            data: { payloadHash: ref.payloadHash, lastSyncedAt: syncedAt },
          },
        },
      },
      select: { id: true },
    });
  }

  /**
   * Склад сезону = те, що дав провайдер (`createMany skipDuplicates` + прибрати зайвих).
   * Порожній список не приходить сюди: збій провайдера не має спустошити склад.
   */
  async replaceSeasonClubs(seasonId: string, clubIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.seasonClub.createMany({
        data: clubIds.map((clubId) => ({ seasonId, clubId })),
        skipDuplicates: true,
      }),
      this.prisma.seasonClub.deleteMany({
        where: { seasonId, clubId: { notIn: clubIds } },
      }),
    ]);
  }

  // ─── Match ───

  /**
   * Чанк матчів однією транзакцією (6.2 п. 5). Оновлення — у порядку `matchId`: LIVE-синк
   * блокує рядки в тому ж порядку, тож без deadlock-ів (5.0 п. 4). `Match` не видаляється.
   */
  async writeMatchChunk(
    provider: DataProvider,
    chunk: MatchChunkWrite,
    syncedAt: Date,
  ): Promise<void> {
    const createTarget = chunk.createTarget;
    if (chunk.creates.length > 0 && !createTarget) {
      throw new Error('writeMatchChunk: creates without createTarget');
    }
    const sortedUpdates = [...chunk.updates].sort((left, right) =>
      left.matchId < right.matchId ? -1 : 1,
    );
    await this.prisma.$transaction(async (tx) => {
      for (const matchUpdate of sortedUpdates) {
        await tx.match.update({
          where: { id: matchUpdate.matchId },
          data: {
            ...matchUpdate.fields,
            externalRefs: {
              update: {
                where: {
                  provider_externalId: {
                    provider,
                    externalId: matchUpdate.externalId,
                  },
                },
                data: {
                  payloadHash: matchUpdate.payloadHash,
                  lastSyncedAt: syncedAt,
                },
              },
            },
          },
          select: { id: true },
        });
      }
      for (const newMatch of chunk.creates) {
        await tx.match.create({
          data: {
            competitionId: createTarget!.competitionId,
            seasonId: createTarget!.seasonId,
            ...newMatch.fields,
            externalRefs: {
              create: {
                provider,
                externalId: newMatch.externalId,
                payloadHash: newMatch.payloadHash,
                lastSyncedAt: syncedAt,
              },
            },
          },
          select: { id: true },
        });
      }
      if (chunk.unchangedExternalIds.length > 0) {
        await tx.matchExternalRef.updateMany({
          where: { provider, externalId: { in: chunk.unchangedExternalIds } },
          data: { lastSyncedAt: syncedAt },
        });
      }
    }, SYNC_TRANSACTION_OPTIONS);
  }

  // ─── Standing ───

  /**
   * Одна таблиця `(seasonId, stage, groupName, type)` атомарно (6.2 п. 6, P5-9).
   * `FOR NO KEY UPDATE` рядка сезону серіалізує повний і LIVE-синк, що міняють таблиці
   * одного сезону (інакше обидва видалили б старе й обидва вставили нове → P2002), і не
   * конфліктує з FK-`KEY SHARE`, який бере вставка матчу цього сезону.
   */
  async replaceStandingTable(
    seasonId: string,
    tableKey: StandingTableKey,
    rows: StandingRowRecord[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<unknown[]>`
        SELECT 1 FROM "Season" WHERE "id" = ${seasonId} FOR NO KEY UPDATE`;
      await tx.standing.deleteMany({ where: { seasonId, ...tableKey } });
      await tx.standing.createMany({
        data: rows.map((row) => ({ ...row, seasonId, ...tableKey })),
      });
    }, SYNC_TRANSACTION_OPTIONS);
  }
}

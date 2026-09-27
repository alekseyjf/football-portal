import { Injectable } from '@nestjs/common';
import type { DataProvider, MatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Наша сутність за id провайдера + хеш останнього записаного payload (P5-6). */
export type ExternalRefState = { entityId: string; payloadHash: string | null };

/** Для матчу — ще й статус у БД: LIVE-синк бачить перехід у `FINISHED` (P5-11). */
export type MatchRefState = ExternalRefState & { status: MatchStatus };

/**
 * `*ExternalRef` — єдине місце, де зберігаються id провайдера (розділ 4).
 * Resolve — батчем, одним запитом на тип (6.2 п. 2). Самі посилання створюються
 * вкладеним записом разом із сутністю (`FootballSyncRepository`) — в одній транзакції.
 */
@Injectable()
export class ExternalRefRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolveClubs(
    provider: DataProvider,
    externalIds: string[],
  ): Promise<Map<string, ExternalRefState>> {
    if (externalIds.length === 0) return new Map();
    const refs = await this.prisma.clubExternalRef.findMany({
      where: { provider, externalId: { in: externalIds } },
      select: { externalId: true, clubId: true, payloadHash: true },
    });
    return new Map(
      refs.map((ref) => [
        ref.externalId,
        { entityId: ref.clubId, payloadHash: ref.payloadHash },
      ]),
    );
  }

  async resolveMatches(
    provider: DataProvider,
    externalIds: string[],
  ): Promise<Map<string, MatchRefState>> {
    if (externalIds.length === 0) return new Map();
    const refs = await this.prisma.matchExternalRef.findMany({
      where: { provider, externalId: { in: externalIds } },
      select: {
        externalId: true,
        matchId: true,
        payloadHash: true,
        match: { select: { status: true } },
      },
    });
    return new Map(
      refs.map((ref) => [
        ref.externalId,
        {
          entityId: ref.matchId,
          payloadHash: ref.payloadHash,
          status: ref.match.status,
        },
      ]),
    );
  }

  async resolveSeason(
    provider: DataProvider,
    externalId: string,
  ): Promise<ExternalRefState | null> {
    const ref = await this.prisma.seasonExternalRef.findUnique({
      where: { provider_externalId: { provider, externalId } },
      select: { seasonId: true, payloadHash: true },
    });
    return ref
      ? { entityId: ref.seasonId, payloadHash: ref.payloadHash }
      : null;
  }

  async findCompetitionRef(
    provider: DataProvider,
    competitionId: string,
  ): Promise<{ externalId: string; payloadHash: string | null } | null> {
    return this.prisma.competitionExternalRef.findUnique({
      where: { provider_competitionId: { provider, competitionId } },
      select: { externalId: true, payloadHash: true },
    });
  }

  /**
   * Клуби побачено в провайдера без змін — лише мітка часу, одним запитом (для матчів те
   * саме робить `FootballSyncRepository.writeMatchChunk` у транзакції чанку).
   */
  async touchClubs(
    provider: DataProvider,
    externalIds: string[],
    syncedAt: Date,
  ): Promise<void> {
    if (externalIds.length === 0) return;
    await this.prisma.clubExternalRef.updateMany({
      where: { provider, externalId: { in: externalIds } },
      data: { lastSyncedAt: syncedAt },
    });
  }
}

import { Injectable } from '@nestjs/common';
import {
  DataProvider,
  Prisma,
  SyncScope,
  SyncStatus,
  SyncTrigger,
} from '@prisma/client';
import { isUniqueViolationOn } from '../../prisma/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';

export type SyncRunTarget = {
  provider: DataProvider;
  scope: SyncScope;
  /** Slug турніру */
  targetRef: string;
};

export type SyncRunStartOptions = {
  trigger: SyncTrigger;
  /** `RUNNING` старший за це — процес помер посеред синку: позначаємо `FAILED` і стартуємо */
  staleAfterMs: number;
  /** Не стартувати, якщо попередній запуск цілі молодший за інтервал (LIVE-throttle) */
  minIntervalMs?: number;
};

const ERROR_MESSAGE_MAX_LENGTH = 500;
const STALE_RUN_MESSAGE = 'STALE: процес завершився, не закривши запуск';

const SYNC_RUN_PUBLIC_SELECT = {
  id: true,
  provider: true,
  scope: true,
  targetRef: true,
  trigger: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  stats: true,
  errorMessage: true,
} satisfies Prisma.SyncRunSelect;

export type SyncRunRow = Prisma.SyncRunGetPayload<{
  select: typeof SYNC_RUN_PUBLIC_SELECT;
}>;

/**
 * Журнал синків і лок (D6, P5-10). Лок — partial unique `SyncRun_single_running_idx`
 * (один `RUNNING` на provider + scope + ціль); перевірка «застарілий / нещодавній запуск»
 * і створення — в одній транзакції під advisory-локом цілі, тож атомарні.
 */
@Injectable()
export class SyncRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** id нового `RUNNING` або `null`, якщо ціль уже синкається / синкалась щойно. */
  async tryStart(
    target: SyncRunTarget,
    options: SyncRunStartOptions,
  ): Promise<string | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lockKey = `sync-run:${target.provider}:${target.scope}:${target.targetRef}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const now = new Date();
        await tx.syncRun.updateMany({
          where: {
            ...target,
            status: SyncStatus.RUNNING,
            startedAt: { lt: new Date(now.getTime() - options.staleAfterMs) },
          },
          data: {
            status: SyncStatus.FAILED,
            finishedAt: now,
            errorMessage: STALE_RUN_MESSAGE,
          },
        });

        const blockingRun = await tx.syncRun.findFirst({
          where: {
            ...target,
            OR: [
              { status: SyncStatus.RUNNING },
              ...(options.minIntervalMs
                ? [
                    {
                      startedAt: {
                        gte: new Date(now.getTime() - options.minIntervalMs),
                      },
                    },
                  ]
                : []),
            ],
          },
          select: { id: true },
        });
        if (blockingRun) return null;

        const createdRun = await tx.syncRun.create({
          data: { ...target, trigger: options.trigger, startedAt: now },
          select: { id: true },
        });
        return createdRun.id;
      });
    } catch (error) {
      // Страховка на випадок запису в обхід advisory-локу: partial unique — останній рубіж
      if (isUniqueViolationOn(error, 'SyncRun')) return null;
      throw error;
    }
  }

  /** Закриває лише свій `RUNNING`: якщо його вже позначили `STALE`, нічого не перезаписує. */
  async finish(
    runId: string,
    status: SyncStatus,
    stats: Prisma.InputJsonObject,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.syncRun.updateMany({
      where: { id: runId, status: SyncStatus.RUNNING },
      data: {
        status,
        finishedAt: new Date(),
        stats,
        errorMessage: errorMessage?.slice(0, ERROR_MESSAGE_MAX_LENGTH) ?? null,
      },
    });
  }

  findRecent(limit: number): Promise<SyncRunRow[]> {
    return this.prisma.syncRun.findMany({
      select: SYNC_RUN_PUBLIC_SELECT,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}

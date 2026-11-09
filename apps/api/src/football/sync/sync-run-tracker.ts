import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Prisma, SyncStatus } from '@prisma/client';
import {
  SyncRunRepository,
  type SyncRunStartOptions,
  type SyncRunTarget,
} from '../persistence/sync-run.repository';
import { describeSyncError } from './football-sync-stats';

/**
 * Запуски синку цього процесу (M1.11.7, D36). Кожен деплой і рестарт Render Free — SIGTERM (`enableShutdownHooks`):
 * без закриття `RUNNING` блокував би наступний синк турніру до 10 хв (застарілий — `tryStart`). Закриваємо лише свої:
 * при деплої без простою Render ~1 хв тримає старий і новий процес на одній БД (D61), і чужий ще синкає.
 */
@Injectable()
export class SyncRunTracker implements BeforeApplicationShutdown {
  private readonly log = new Logger(SyncRunTracker.name);
  private readonly activeRunIds = new Set<string>();

  constructor(private readonly syncRuns: SyncRunRepository) {}

  /** id нового `RUNNING` або `null`, якщо ціль уже синкається / синкалась щойно. */
  async start(
    target: SyncRunTarget,
    options: SyncRunStartOptions,
  ): Promise<string | null> {
    const runId = await this.syncRuns.tryStart(target, options);
    if (runId) this.activeRunIds.add(runId);
    return runId;
  }

  /** Не закритий через збій БД лишається у списку: його закриє зупинка процесу або `tryStart` як застарілий. */
  async finish(
    runId: string,
    status: SyncStatus,
    stats: Prisma.InputJsonObject,
    errorMessage?: string,
  ): Promise<void> {
    await this.syncRuns.finish(runId, status, stats, errorMessage);
    this.activeRunIds.delete(runId);
  }

  /** Зупинка процесу посеред синку: свої `RUNNING` — `FAILED` одразу; далі Nest завершує процес. */
  async beforeApplicationShutdown(signal?: string): Promise<void> {
    if (this.activeRunIds.size === 0) return;
    const runIds = [...this.activeRunIds];
    try {
      const closedCount = await this.syncRuns.failInterrupted(
        runIds,
        `SHUTDOWN: процес зупинено посеред синку (${signal ?? 'close'})`,
      );
      this.log.warn(`Зупинка: перервано синків — ${closedCount}`);
    } catch (error) {
      this.log.error(
        `Зупинка: SyncRun не закрито (${runIds.join(', ')}): ${describeSyncError(error)}`,
      );
    }
  }
}

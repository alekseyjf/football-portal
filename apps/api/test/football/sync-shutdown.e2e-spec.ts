import {
  DataProvider,
  SyncScope,
  SyncStatus,
  SyncTrigger,
} from '@prisma/client';
import { FULL_SYNC_STALE_AFTER_MS } from '../../src/football/football.constants';
import { SyncRunTracker } from '../../src/football/sync/sync-run-tracker';
import { createE2eApp } from '../support/e2e-app';
import { resetE2eData } from '../support/e2e-database';

const FULL_SYNC = {
  provider: DataProvider.FOOTBALL_DATA,
  scope: SyncScope.COMPETITION_FULL,
};
const START_OPTIONS = {
  trigger: SyncTrigger.CRON,
  staleAfterMs: FULL_SYNC_STALE_AFTER_MS,
};

/*
 * Деплой чи рестарт Render — SIGTERM посеред синку (M1.11.7, D36). `app.close()` — ті самі хуки зупинки, що
 * `enableShutdownHooks` викликає на сигнал (сам сигнал у Jest не надіслати: Nest наприкінці вбиває процес).
 */
describe('Зупинка API посеред синку', () => {
  it('свої незакриті запуски — FAILED одразу; закритий і чужий RUNNING (інший процес на тій самій БД) — без змін', async () => {
    const e2e = await createE2eApp();
    try {
      await resetE2eData(e2e.prisma);
      const tracker = e2e.app.get(SyncRunTracker);
      const interruptedRunId = await tracker.start(
        { ...FULL_SYNC, targetRef: 'PL' },
        START_OPTIONS,
      );
      const finishedRunId = await tracker.start(
        { ...FULL_SYNC, targetRef: 'CL' },
        START_OPTIONS,
      );
      await tracker.finish(finishedRunId!, SyncStatus.SUCCEEDED, {});
      // Тест-сервер і локальна розробка ділять БД (D58): чужий синк іде далі
      const foreignRun = await e2e.prisma.syncRun.create({
        data: {
          ...FULL_SYNC,
          targetRef: 'BL1',
          trigger: SyncTrigger.CRON,
          startedAt: new Date(),
        },
        select: { id: true },
      });

      await e2e.app.close();

      const statusOf = async (id: string) =>
        e2e.prisma.syncRun.findUniqueOrThrow({
          where: { id },
          select: { status: true, errorMessage: true, finishedAt: true },
        });
      expect(await statusOf(interruptedRunId!)).toMatchObject({
        status: SyncStatus.FAILED,
        errorMessage: expect.stringContaining('SHUTDOWN') as unknown,
        finishedAt: expect.any(Date) as unknown,
      });
      expect(await statusOf(finishedRunId!)).toMatchObject({
        status: SyncStatus.SUCCEEDED,
      });
      expect(await statusOf(foreignRun.id)).toMatchObject({
        status: SyncStatus.RUNNING,
        finishedAt: null,
      });
    } finally {
      await e2e.prisma.$disconnect();
    }
  });
});

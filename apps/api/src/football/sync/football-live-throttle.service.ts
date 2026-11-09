import { Inject, Injectable } from '@nestjs/common';
import { SyncScope, type SyncTrigger } from '@prisma/client';
import {
  LIVE_SYNC_MIN_INTERVAL_MS,
  LIVE_SYNC_STALE_AFTER_MS,
} from '../football.constants';
import {
  FOOTBALL_PROVIDER,
  type FootballProvider,
} from '../integration/football-provider.port';
import { SyncRunTracker } from './sync-run-tracker';

/**
 * Троттлінг LIVE-синку на турнір через `SyncRun` (P5-11): спільний для всіх інстансів API
 * і переживає рестарт (було — `Map` у пам'яті процесу).
 */
@Injectable()
export class FootballLiveThrottleService {
  constructor(
    @Inject(FOOTBALL_PROVIDER) private readonly provider: FootballProvider,
    private readonly syncRunTracker: SyncRunTracker,
  ) {}

  /** id нового LIVE-запуску або `null`: турнір уже синкається чи синкався щойно. */
  tryStartLiveRun(
    competitionSlug: string,
    trigger: SyncTrigger,
  ): Promise<string | null> {
    return this.syncRunTracker.start(
      {
        provider: this.provider.provider,
        scope: SyncScope.MATCHES_LIVE,
        targetRef: competitionSlug,
      },
      {
        trigger,
        staleAfterMs: LIVE_SYNC_STALE_AFTER_MS,
        minIntervalMs: LIVE_SYNC_MIN_INTERVAL_MS,
      },
    );
  }
}

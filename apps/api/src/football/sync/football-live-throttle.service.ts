import { Injectable } from '@nestjs/common';
import { FOOTBALL_LIVE_THROTTLE_MS } from '../football.constants';

/**
 * Троттлінг LIVE-синку по `league.externalId`.
 * Реалізація в пам’яті процесу; при горизонтальному масштабуванні замінити на Redis / shared store.
 */
@Injectable()
export class FootballLiveThrottleService {
  private readonly lastByCompetition = new Map<number, number>();

  /**
   * @returns true якщо слот «зайнято» і sync не варто запускати
   */
  isThrottled(competitionExternalId: number, now = Date.now()): boolean {
    const last = this.lastByCompetition.get(competitionExternalId) ?? 0;
    return now - last < FOOTBALL_LIVE_THROTTLE_MS;
  }

  mark(competitionExternalId: number, now = Date.now()): void {
    this.lastByCompetition.set(competitionExternalId, now);
  }
}

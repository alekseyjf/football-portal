import { useTranslations } from 'next-intl';
import {
  IN_PLAY_MATCH_STATUSES,
  TERMINAL_MATCH_STATUSES,
  type MatchStatusDto,
} from '@/lib/api/types';

/** Підпис статусу матчу: `PAUSED` → «HT» / «Перерва». Невідомий статус — як є. */
export function useMatchStatusLabel() {
  const t = useTranslations('match');
  return (status: MatchStatusDto): string =>
    t.has(`status.${status}`) ? t(`status.${status}`) : status;
}

/** Гра йде зараз (включно з перервою): червоне оформлення, хвилина, автооновлення. */
export function isMatchInPlay(status: MatchStatusDto): boolean {
  return IN_PLAY_MATCH_STATUSES.includes(status);
}

/** Статус остаточний — `live-touch` не потрібен. */
export function isMatchTerminal(status: MatchStatusDto): boolean {
  return TERMINAL_MATCH_STATUSES.includes(status);
}

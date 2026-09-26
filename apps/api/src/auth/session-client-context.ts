import type { Request } from 'express';

/** Звідки прийшов логін/refresh — для списку пристроїв і розслідування reuse. */
export interface SessionClientContext {
  userAgent: string | null;
  ipAddress: string | null;
}

/** Заголовок контролює клієнт — обрізаємо, щоб не писати в БД кілобайти. */
const USER_AGENT_MAX_LENGTH = 512;
/** IPv6 з IPv4-хвостом — до 45 символів. */
const IP_ADDRESS_MAX_LENGTH = 45;

/**
 * `req.ip` за reverse proxy буде адресою проксі, доки не налаштовано `trust proxy` (деплой).
 */
export function readSessionClientContext(req: Request): SessionClientContext {
  return {
    userAgent: req.get('user-agent')?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    ipAddress: req.ip?.slice(0, IP_ADDRESS_MAX_LENGTH) ?? null,
  };
}

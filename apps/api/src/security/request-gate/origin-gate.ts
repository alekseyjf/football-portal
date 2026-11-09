import { isIP } from 'node:net';
import {
  CLIENT_IP_HEADER,
  ORIGIN_SECRET_HEADER,
} from '@football-portal/validation';
import { isOriginSecretValid } from '@football-portal/validation/site-gateway';
import type { Request, RequestHandler } from 'express';
import { API_GLOBAL_PREFIX } from '../../app.constants';
import { rejectRequest } from './reject-request';

/** Запит не від сервера сайту чи адмінки: API на `*.onrender.com` напряму закритий (D59). */
export const DIRECT_API_ACCESS_FORBIDDEN = 'DIRECT_API_ACCESS_FORBIDDEN';

/** Без секрету — лише перевірка здоров'я: хостинг, пінг GitHub Actions і монітор (D33, D58). */
const PATHS_WITHOUT_SECRET: ReadonlySet<string> = new Set([
  `/${API_GLOBAL_PREFIX}/health`,
]);

/**
 * Шлюз API (M1.11.3, D59): з `API_ORIGIN_SECRET` API приймає лише запити від серверів web і адмінки — SSR і їхній
 * проксі `/api/*`, — а IP клієнта бере з `x-client-ip`, який ставить сервер сайту. Без секрету в запиті — 403, тож
 * підроблений `X-Forwarded-For` нікуди не дійде. Підключається першим у `configureHttpApp`.
 * `originSecrets` — чинний секрет, а на час ротації ще й старий (`API_ORIGIN_SECRET_PREVIOUS`).
 */
export function createOriginGate(
  originSecrets: readonly string[],
): RequestHandler {
  return (req, res, next) => {
    if (isAnyOriginSecretValid(req.get(ORIGIN_SECRET_HEADER), originSecrets)) {
      useForwardedClientIp(req);
      next();
      return;
    }
    if (PATHS_WITHOUT_SECRET.has(req.path)) {
      next();
      return;
    }
    rejectRequest(res, 403, DIRECT_API_ACCESS_FORBIDDEN);
  };
}

/** Порівнюємо з усіма секретами, без раннього виходу: час відповіді не каже, котрий із них збігся. */
function isAnyOriginSecretValid(
  providedSecret: string | undefined,
  originSecrets: readonly string[],
): boolean {
  return originSecrets
    .map((originSecret) => isOriginSecretValid(providedSecret, originSecret))
    .includes(true);
}

/**
 * `req.ip` — IP браузера від сервера сайту: його читають ліміти спроб (throttler) і `AuthSession.ipAddress`.
 * Express рахує `req.ip` гетером прототипу — власна властивість запиту його перекриває. SSR IP не передає
 * (у нього немає браузера) — тоді `req.ip` лишається за `TRUST_PROXY`.
 */
function useForwardedClientIp(req: Request): void {
  const clientIp = req.get(CLIENT_IP_HEADER)?.trim();
  if (!clientIp || isIP(clientIp) === 0) return;
  Object.defineProperty(req, 'ip', {
    value: clientIp,
    configurable: true,
    enumerable: true,
  });
}

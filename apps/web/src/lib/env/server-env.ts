import 'server-only';
import type { ApiProxyTarget } from '@football-portal/validation/site-gateway';
import { parseServerEnv, type ServerEnv } from './server-env-schema';

let cachedEnv: ServerEnv | undefined;

/**
 * Перевірені серверні змінні web — лише на сервері (`server-only`: імпорт у клієнтському компоненті ламає збірку).
 * Змінні вже перевірено при старті сервера (`instrumentation-node.ts`); тут — розбір з кешем на весь процес.
 */
export function serverEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}

/** Куди проксі сайту `app/api/[...path]` пересилає запит браузера (D59). */
export function apiProxyTarget(): ApiProxyTarget {
  const { gateway } = serverEnv();
  return {
    apiOrigin: gateway.apiOrigin,
    originSecret: gateway.apiOriginSecret,
  };
}

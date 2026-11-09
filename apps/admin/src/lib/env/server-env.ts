import 'server-only';
import type {
  ApiProxyTarget,
  SiteGatewayEnv,
} from '@football-portal/validation/site-gateway';
import { parseServerEnv } from './server-env-schema';

let cachedEnv: SiteGatewayEnv | undefined;

/** Змінні вже перевірено при старті сервера (`instrumentation-node.ts`); тут — розбір з кешем на весь процес. */
function serverEnv(): SiteGatewayEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}

/** Куди проксі адмінки `app/api/[...path]` пересилає запит браузера (D59). */
export function apiProxyTarget(): ApiProxyTarget {
  const gateway = serverEnv();
  return {
    apiOrigin: gateway.apiOrigin,
    originSecret: gateway.apiOriginSecret,
  };
}

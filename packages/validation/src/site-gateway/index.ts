/**
 * Шлюз сайту й адмінки до API і закритий тест-сервер (M1.11.3, M1.11.6, D59) — контракт між застосунками, тож він тут,
 * в одному місці. Лише для сервера (`node:crypto`, `node:net`): web і адмінка беруть його в `proxy.ts`, Route Handler
 * `app/api/[...path]` і схемі серверних змінних; API — перевірку секрету. Клієнтському коду — константи з кореня пакета.
 */
export {
  API_PROXY_TIMEOUT_MS,
  API_UNAVAILABLE,
  clientIpOf,
  forwardToApi,
  isOriginSecretValid,
  type ApiProxyTarget,
} from './api-proxy';
export {
  basicAuthChallenge,
  isBasicAuthorized,
  type BasicAuthCredentials,
} from './basic-auth';
export {
  APP_ENVS,
  BASIC_AUTH_PASSWORD_MIN_LENGTH,
  basicAuthGate,
  resolveSiteGatewayEnv,
  siteGatewayEnvShape,
  type AppEnvironment,
  type BasicAuthGate,
  type EnvProblem,
  type SiteGatewayEnv,
} from './site-env';

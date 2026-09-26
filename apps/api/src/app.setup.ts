import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_GLOBAL_PREFIX } from './app.constants';
import {
  ACCOUNT_THROTTLER,
  IP_THROTTLER,
} from './security/throttling/request-throttling';

/**
 * HTTP-налаштування застосунку. Окремо від `main.ts`, щоб тестовий застосунок
 * піднімався з тією самою конфігурацією (helmet, CORS, trust proxy).
 */
export function configureHttpApp(app: NestExpressApplication): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY, isProduction);
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
  const allowedOrigins = parseCorsOrigins(
    process.env.CORS_ORIGINS,
    isProduction,
  );

  // Security-заголовки + прибирає `X-Powered-By`. CORP `same-site`: web/admin на тому ж
  // сайті (localhost:3000/3001 ↔ :4000; на проді — піддомени), а не лише same-origin
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

  app.enableCors({
    // Точний збіг зі списком; без Origin (curl, SSR) CORS-заголовків не ставимо
    origin: (requestOrigin, callback) =>
      callback(null, !!requestOrigin && allowedOrigins.has(requestOrigin)),
    credentials: true, // Обов'язково для cookies
    // Скільки чекати після 429 — фронту потрібно бачити ці заголовки
    exposedHeaders: [
      `Retry-After-${IP_THROTTLER}`,
      `Retry-After-${ACCOUNT_THROTTLER}`,
    ],
  });

  app.use(cookieParser());

  // Глобальна валідація — всі DTO автоматично валідуються
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix(API_GLOBAL_PREFIX);
}

/**
 * `TRUST_PROXY` — скільки reverse proxy стоїть перед API (напр. `1`) або їхні адреси/підмережі
 * (`loopback`, `10.0.0.0/8`); `0` / `false` — проксі немає. Express тоді бере `req.ip`
 * з `X-Forwarded-For`, відкинувши рівно стільки довірених хопів.
 * Без нього за проксі `req.ip` = адреса проксі: ліміти на IP спільні для всіх,
 * а `AuthSession.ipAddress` марний — тому на проді значення обов'язкове (свідоме рішення).
 * У dev порожньо: без проксі довіра до `X-Forwarded-For` дозволила б підробляти IP.
 * `true` заборонено: тоді `req.ip` — крайній лівий `X-Forwarded-For`, який підробляє клієнт.
 */
function parseTrustProxy(
  rawValue: string | undefined,
  isProduction: boolean,
): number | string | undefined {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    if (isProduction) {
      throw new Error(
        'TRUST_PROXY is required in production: proxy hop count (e.g. 1) or 0 if there is no proxy',
      );
    }
    return undefined;
  }
  if (trimmed === 'false') return 0;
  if (trimmed === 'true') {
    throw new Error(
      'TRUST_PROXY=true lets clients spoof their IP via X-Forwarded-For; set a hop count (e.g. 1) or proxy addresses',
    );
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * `CORS_ORIGINS` — через кому, напр. `http://localhost:3000,http://localhost:3001`.
 * Кожне значення — рівно origin (`scheme://host[:port]`): без шляху, `/` у кінці і `*`
 * (з `credentials: true` wildcard неприпустимий). На проді — лише https.
 */
function parseCorsOrigins(
  rawValue: string | undefined,
  isProduction: boolean,
): ReadonlySet<string> {
  const configuredOrigins = (rawValue ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configuredOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS is required: comma-separated web/admin origins, e.g. https://example.com',
    );
  }

  for (const origin of configuredOrigins) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS: "${origin}" is not a valid origin`);
    }
    if (parsedOrigin.origin !== origin) {
      throw new Error(
        `CORS_ORIGINS: "${origin}" must be exactly an origin (expected "${parsedOrigin.origin}")`,
      );
    }
    const allowedProtocols = isProduction ? ['https:'] : ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedOrigin.protocol)) {
      throw new Error(
        `CORS_ORIGINS: "${origin}" must use ${allowedProtocols.join(' or ')}`,
      );
    }
  }
  return new Set(configuredOrigins);
}

import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_GLOBAL_PREFIX } from './app.constants';
import {
  ACCOUNT_THROTTLER,
  IP_THROTTLER,
} from './security/throttling/request-throttling';

const WEB_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

/**
 * HTTP-налаштування застосунку. Окремо від `main.ts`, щоб тестовий застосунок
 * піднімався з тією самою конфігурацією (helmet, CORS, trust proxy).
 */
export function configureHttpApp(app: NestExpressApplication): void {
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);

  // Security-заголовки + прибирає `X-Powered-By`. CORP `same-site`: web/admin на тому ж
  // сайті (localhost:3000/3001 ↔ :4000; на проді — піддомени), а не лише same-origin
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

  app.enableCors({
    origin: WEB_ORIGINS,
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
 * (`loopback`, `10.0.0.0/8`). Без нього за проксі `req.ip` = адреса проксі: ліміти на IP
 * спільні для всіх, а `AuthSession.ipAddress` марний.
 * `true` заборонено: тоді `req.ip` береться з `X-Forwarded-For`, який підробляє клієнт.
 */
function parseTrustProxy(
  rawValue: string | undefined,
): number | string | undefined {
  const trimmed = rawValue?.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'true') {
    throw new Error(
      'TRUST_PROXY=true lets clients spoof their IP via X-Forwarded-For; set a hop count (e.g. 1) or proxy addresses',
    );
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

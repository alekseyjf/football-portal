import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_GLOBAL_PREFIX, JSON_BODY_LIMIT } from './app.constants';
import { envConfig } from './config/env.config';
import type { AppEnv } from './config/env.schema';
import { setupSwaggerUi } from './openapi/openapi-document';
import { createCrossSiteRequestGuard } from './security/request-gate/cross-site-request';
import { createOriginGate } from './security/request-gate/origin-gate';
import {
  ACCOUNT_THROTTLER,
  IP_THROTTLER,
} from './security/throttling/request-throttling';

/** API — не сайт: жодна відповідь не для пошуковиків, і пересланий сайтом JSON теж (M1.11.6). */
const NOINDEX_HEADER = 'noindex, nofollow';

/**
 * HTTP-налаштування застосунку. Окремо від `main.ts`, щоб тестовий застосунок
 * піднімався з тією самою конфігурацією (helmet, шлюз, CSRF, CORS, trust proxy, Swagger UI).
 */
export function configureHttpApp(app: NestExpressApplication): void {
  // Значення вже перевірені схемою: там і пояснення до TRUST_PROXY / CORS_ORIGINS
  const env = app.get<AppEnv>(envConfig.KEY);
  if (env.TRUST_PROXY !== undefined) app.set('trust proxy', env.TRUST_PROXY);
  const allowedOrigins: ReadonlySet<string> = new Set(env.CORS_ORIGINS);

  // Security-заголовки + прибирає `X-Powered-By`. CORP `same-site`: web/admin на тому ж
  // сайті (localhost:3000/3001 ↔ :4000; на проді — піддомени), а не лише same-origin
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Robots-Tag', NOINDEX_HEADER);
    next();
  });
  // Шлюз (D59): з секретом API приймає лише сервери web і адмінки; без нього (локально) — усіх, як раніше.
  // На час ротації — ще й старий секрет (`API_ORIGIN_SECRET_PREVIOUS`), поки web і адмінка не перейдуть на новий
  if (env.API_ORIGIN_SECRET) {
    const originSecrets = [
      env.API_ORIGIN_SECRET,
      env.API_ORIGIN_SECRET_PREVIOUS,
    ].filter((secret): secret is string => secret !== undefined);
    app.use(createOriginGate(originSecrets));
  }

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

  // CSRF (D60): мутація з чужого сайту чи не JSON — відмова ще до розбору тіла й cookies
  app.use(createCrossSiteRequestGuard(env.CORS_ORIGINS));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });

  // Глобальна валідація — всі DTO автоматично валідуються
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  setupSwaggerUi(app, env);
}

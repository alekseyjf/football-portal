import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_GLOBAL_PREFIX, JSON_BODY_LIMIT } from './app.constants';
import { envConfig } from './config/env.config';
import type { AppEnv } from './config/env.schema';
import {
  ACCOUNT_THROTTLER,
  IP_THROTTLER,
} from './security/throttling/request-throttling';

/**
 * HTTP-налаштування застосунку. Окремо від `main.ts`, щоб тестовий застосунок
 * піднімався з тією самою конфігурацією (helmet, CORS, trust proxy).
 */
export function configureHttpApp(app: NestExpressApplication): void {
  // Значення вже перевірені схемою: там і пояснення до TRUST_PROXY / CORS_ORIGINS
  const env = app.get<AppEnv>(envConfig.KEY);
  if (env.TRUST_PROXY !== undefined) app.set('trust proxy', env.TRUST_PROXY);
  const allowedOrigins: ReadonlySet<string> = new Set(env.CORS_ORIGINS);

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
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });

  // Глобальна валідація — всі DTO автоматично валідуються
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix(API_GLOBAL_PREFIX);
}

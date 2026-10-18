import { randomBytes } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { API_GLOBAL_PREFIX } from '../../src/app.constants';
import { AppModule } from '../../src/app.module';
import { configureHttpApp } from '../../src/app.setup';
import { envConfig } from '../../src/config/env.config';
import { parseEnv, type AppEnv } from '../../src/config/env.schema';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertE2eSearchPath,
  createE2ePrismaClient,
  resolveE2eDatabaseUrl,
} from './e2e-database';

export interface E2eApp {
  app: NestExpressApplication;
  /** Той самий клієнт, що й у застосунку: фікстури й перевірка стану БД */
  prisma: PrismaClient;
  close(): Promise<void>;
}

export interface E2eAppOptions {
  /** Лише для тестів «БД недоступна»: адреса без робочої БД. Без неї — схема `e2e`. */
  unavailableDatabaseUrl?: string;
}

/** `apiPath('/health')` → `/api/v1/health` */
export function apiPath(path: string): string {
  return `/${API_GLOBAL_PREFIX}${path}`;
}

/** Свій секрет на кожен застосунок: секрети розробки з `.env` у тести не потрапляють. */
function randomSecret(): string {
  return randomBytes(32).toString('base64');
}

/** Env — з нуля, без `process.env`: без ключа football-data синк відповідає 503 і квоту не витрачає. */
function buildE2eEnv(): AppEnv {
  return parseEnv({
    NODE_ENV: 'test',
    // БД застосунок бачить лише через PrismaService, а його тут замінено. Рядок нікуди не веде:
    // тест, що обійде createE2eApp, впаде на з'єднанні, а не запише в `public`
    DATABASE_URL:
      'postgresql://e2e-prisma-service-is-replaced@127.0.0.1:1/unused',
    JWT_SECRET: randomSecret(),
    EMAIL_HASH_SECRET: randomSecret(),
    CORS_ORIGINS: 'http://localhost:3000',
  });
}

/**
 * Застосунок як у `main.ts` (`configureHttpApp`: префікс, валідація, cookies, helmet), але з env
 * тестів і клієнтом Prisma на схему `e2e`. Дані не скидає — це робить `resetE2eData` у тесті.
 */
export async function createE2eApp(
  options: E2eAppOptions = {},
): Promise<E2eApp> {
  const prisma = options.unavailableDatabaseUrl
    ? new PrismaClient({
        adapter: new PrismaPg(options.unavailableDatabaseUrl),
      })
    : createE2ePrismaClient(resolveE2eDatabaseUrl().url);
  try {
    if (!options.unavailableDatabaseUrl) await assertE2eSearchPath(prisma);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(envConfig.KEY)
      .useValue(buildE2eEnv())
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({
      // Тести «БД недоступна» чекають помилок — червоний лог terminus у зеленому прогоні лише плутає
      logger: options.unavailableDatabaseUrl ? false : ['error', 'warn'],
    });
    configureHttpApp(app);
    await app.init();
    return {
      app,
      prisma,
      close: async () => {
        await app.close();
        await prisma.$disconnect();
      },
    };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

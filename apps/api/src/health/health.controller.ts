import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

/** Ключ перевірки БД у відповіді (`details.database.status`). */
const DATABASE_CHECK_KEY = 'database';

/**
 * Скільки чекаємо `SELECT 1`. Без таймауту запит на «мертвому» сокеті пулера висить ~15 хв (OQ-11),
 * а з ним і health. Нове з'єднання з Supabase — ~0,2–0,4 с, тож 3 с — із запасом.
 */
const DATABASE_PING_TIMEOUT_MS = 3000;

/**
 * Для хостингу й uptime-монітора (D33): 200 — API і БД працюють, 503 — БД недоступна.
 * У відповіді лише статуси: адресу сервера з помилки з'єднання terminus не віддає.
 * `@HealthCheck()` забороняє кешування (`Cache-Control: no-store`).
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaHealthIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  checkHealth() {
    return this.healthCheckService.check([
      () =>
        this.prismaHealthIndicator.pingCheck(DATABASE_CHECK_KEY, this.prisma, {
          timeout: DATABASE_PING_TIMEOUT_MS,
        }),
    ]);
  }
}

import { Module } from '@nestjs/common';
import { minutes, ThrottlerModule } from '@nestjs/throttler';
import {
  ACCOUNT_THROTTLER,
  IP_THROTTLER,
  trackAccount,
} from './request-throttling';

/**
 * Ліміти запитів на auth-роутах. `ThrottlerGuard` вмикається **лише** на конкретних
 * роутах (`@UseGuards`), не глобально: SSR Next.js ходить з одного IP сервера —
 * глобальний ліміт на IP душив би всіх відвідувачів разом.
 * Значення нижче — запасні; кожен роут задає свої через політики з `request-throttling.ts`.
 *
 * Сховище — пам'ять процесу: скидається при рестарті й не ділиться між інстансами.
 * Для кількох інстансів на проді — Redis-сховище.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: IP_THROTTLER, ttl: minutes(1), limit: 60 },
        {
          name: ACCOUNT_THROTTLER,
          ttl: minutes(15),
          limit: 10,
          getTracker: trackAccount,
        },
      ],
      errorMessage: 'TOO_MANY_REQUESTS',
    }),
  ],
})
export class RequestThrottlingModule {}

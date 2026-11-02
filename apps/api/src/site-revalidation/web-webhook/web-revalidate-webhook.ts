import {
  type ContentEvent,
  REVALIDATE_SIGNATURE_HEADER,
  REVALIDATE_TIMESTAMP_HEADER,
  signRevalidatePayload,
} from '@football-portal/validation/webhook';
import { Inject, Injectable } from '@nestjs/common';
import { envConfig } from '../../config/env.config';
import type { AppEnv } from '../../config/env.schema';
import { HOME_UPDATED_EVENT, type PostEvent } from '../../posts/post-events';
import type { SiteRevalidator } from '../site-revalidator.port';

/**
 * Сайт відповідає одразу (`revalidateTag` лише позначає кеш застарілим) — довше чекати немає сенсу. Запис на це не
 * чекає взагалі: підписник асинхронний (`PostSiteRevalidationListener`); таймаут лише звільняє з'єднання.
 */
const WEBHOOK_TIMEOUT_MS = 3000;

interface WebhookTarget {
  url: string;
  secret: string;
}

/**
 * Вебхук web `POST /api/revalidate` (D57): тіло — подія (`ContentEvent`), підпис — HMAC з часом
 * (`signRevalidatePayload`; формат — спільний з web, `@football-portal/validation/webhook`), сам секрет не йде. Без `WEB_REVALIDATE_URL` і `REVALIDATE_SECRET` (схема env задає обидві або жодну) — нічого не шле:
 * кеш сайту оновить TTL. Редиректів не йдемо — підписаний запит іде лише на адресу з env.
 */
@Injectable()
export class WebRevalidateWebhook implements SiteRevalidator {
  private readonly target: WebhookTarget | null;

  constructor(@Inject(envConfig.KEY) env: AppEnv) {
    this.target =
      env.WEB_REVALIDATE_URL && env.REVALIDATE_SECRET
        ? { url: env.WEB_REVALIDATE_URL, secret: env.REVALIDATE_SECRET }
        : null;
  }

  postChanged(event: PostEvent): Promise<void> {
    return this.send({ event: event.name, post: event.post });
  }

  homeChanged(): Promise<void> {
    return this.send({ event: HOME_UPDATED_EVENT });
  }

  private async send(payload: ContentEvent): Promise<void> {
    if (!this.target) return;
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await fetch(this.target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [REVALIDATE_TIMESTAMP_HEADER]: String(timestamp),
        [REVALIDATE_SIGNATURE_HEADER]: signRevalidatePayload({
          secret: this.target.secret,
          timestamp,
          body,
        }),
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    // Тіло не потрібне: звільняємо з'єднання
    await response.body?.cancel();
    if (!response.ok) {
      throw new Error(`web answered ${response.status}`);
    }
  }
}

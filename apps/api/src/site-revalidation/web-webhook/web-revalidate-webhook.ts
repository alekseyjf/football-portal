import { Inject, Injectable } from '@nestjs/common';
import { envConfig } from '../../config/env.config';
import type { AppEnv } from '../../config/env.schema';
import type { PostEvent } from '../../posts/post-events';
import type { SiteRevalidator } from '../site-revalidator.port';
import {
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  webhookSignature,
} from './webhook-signature';

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
 * Вебхук web `POST /api/revalidate` (D57): тіло — подія й новина, підпис — HMAC з часом (`webhookSignature`), сам
 * секрет не йде. Без `WEB_REVALIDATE_URL` і `REVALIDATE_SECRET` (схема env задає обидві або жодну) — нічого не шле:
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

  async postChanged(event: PostEvent): Promise<void> {
    if (!this.target) return;
    const body = JSON.stringify({ event: event.name, post: event.post });
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await fetch(this.target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [WEBHOOK_TIMESTAMP_HEADER]: String(timestamp),
        [WEBHOOK_SIGNATURE_HEADER]: webhookSignature({
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

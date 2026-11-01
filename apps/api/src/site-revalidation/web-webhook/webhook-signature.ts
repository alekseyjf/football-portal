import { createHmac } from 'node:crypto';

/*
 * Підпис вебхука web (D57): сам секрет у запиті не йде — лише HMAC-SHA256 від `{timestamp}.{тіло}`. Сайт (M1.8.3)
 * рахує той самий підпис, порівнює за сталий час і відкидає запит зі старим `timestamp` — перехоплений запит не
 * повторити, а http усередині приватної мережі не видає секрет.
 */

export const WEBHOOK_TIMESTAMP_HEADER = 'X-Revalidate-Timestamp';
export const WEBHOOK_SIGNATURE_HEADER = 'X-Revalidate-Signature';

export interface WebhookSignatureInput {
  secret: string;
  /** Секунди Unix — момент відправлення */
  timestamp: number;
  /** Тіло запиту — рівно ті байти, що йдуть у мережу */
  body: string;
}

/** `sha256=<hex>` — значення заголовка `X-Revalidate-Signature`. */
export function webhookSignature(input: WebhookSignatureInput): string {
  const digest = createHmac('sha256', input.secret)
    .update(`${input.timestamp}.${input.body}`)
    .digest('hex');
  return `sha256=${digest}`;
}

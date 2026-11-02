import { describe, expect, it } from 'vitest';
import {
  contentEventSchema,
  signRevalidatePayload,
  verifyRevalidatePayload,
} from './webhook';

// Контрольний вектор D57 — пораховано незалежно (`openssl dgst -sha256 -hmac`). Формат підпису — контракт API й web:
// розійдуться вони — цей тест упаде в обох, а не лише наживо
const VECTOR = {
  secret: 'revalidate-secret-revalidate-secret',
  timestamp: 1_793_368_800,
  body: '{"event":"post.published","post":{"id":"post-1","number":42,"slug":"arsenal-win-the-derby"}}',
  signature:
    'sha256=632534c58b07648847fd0c50b19f728b3866b0afdb4a129d474a4661b796076a',
};
const PREVIOUS_SECRET = 'previous-secret-previous-secret-previous';

function verifyVector(overrides: {
  secrets?: string[];
  timestamp?: string | null;
  signature?: string | null;
  body?: string;
  nowSeconds?: number;
}) {
  return verifyRevalidatePayload({
    secrets: [VECTOR.secret],
    timestamp: String(VECTOR.timestamp),
    signature: VECTOR.signature,
    body: VECTOR.body,
    nowSeconds: VECTOR.timestamp,
    ...overrides,
  });
}

describe('Підпис вебхука сайту: HMAC-SHA256 від `{timestamp}.{тіло}` (D57)', () => {
  it('контрольний вектор: підпис API = очікуваний, і сайт його приймає', () => {
    expect(signRevalidatePayload(VECTOR)).toBe(VECTOR.signature);
    expect(verifyVector({})).toEqual({ valid: true });
  });

  it('вікно ±5 хв в обидва боки: 300 с — ще приймаємо, 301 с — уже ні', () => {
    for (const shift of [-300, 300]) {
      expect(verifyVector({ nowSeconds: VECTOR.timestamp + shift })).toEqual({
        valid: true,
      });
    }
    for (const shift of [-301, 301]) {
      expect(verifyVector({ nowSeconds: VECTOR.timestamp + shift })).toEqual({
        valid: false,
        reason: 'stale-timestamp',
      });
    }
  });

  it('старий запит з новим часом не пройде: час — частина підпису', () => {
    const newTimestamp = VECTOR.timestamp + 600;
    expect(
      verifyVector({
        timestamp: String(newTimestamp),
        nowSeconds: newTimestamp,
      }),
    ).toEqual({ valid: false, reason: 'bad-signature' });
  });

  it('змінене тіло, чужий секрет, інша довжина підпису — відмова без винятку', () => {
    expect(verifyVector({ body: `${VECTOR.body} ` }).valid).toBe(false);
    expect(verifyVector({ secrets: [PREVIOUS_SECRET] }).valid).toBe(false);
    expect(verifyVector({ secrets: [] }).valid).toBe(false);
    for (const signature of [
      'sha256=',
      VECTOR.signature.slice(0, -1),
      `${VECTOR.signature}0`,
      VECTOR.signature.toUpperCase(),
    ]) {
      expect(verifyVector({ signature })).toEqual({
        valid: false,
        reason: 'bad-signature',
      });
    }
  });

  it('ротація секрету: приймаємо підпис і чинним, і попереднім', () => {
    const signedWithPrevious = signRevalidatePayload({
      ...VECTOR,
      secret: PREVIOUS_SECRET,
    });
    expect(
      verifyVector({
        secrets: [VECTOR.secret, PREVIOUS_SECRET],
        signature: signedWithPrevious,
      }),
    ).toEqual({ valid: true });
  });

  it('без заголовків чи час не цифрами — відмова', () => {
    expect(verifyVector({ timestamp: null })).toEqual({
      valid: false,
      reason: 'missing-signature',
    });
    expect(verifyVector({ signature: '' })).toEqual({
      valid: false,
      reason: 'missing-signature',
    });
    for (const timestamp of [
      '1.7933688e9',
      '-1793368800',
      ' 1793368800',
      '0x6ae4d2e0',
    ]) {
      expect(verifyVector({ timestamp })).toEqual({
        valid: false,
        reason: 'stale-timestamp',
      });
    }
  });
});

describe('Тіло вебхука (contentEventSchema)', () => {
  const post = { id: 'post-1', number: 42, slug: 'arsenal-win-the-derby' };

  it('події новини й головної — приймаємо; зайві поля відкидаються', () => {
    for (const event of ['post.published', 'post.updated', 'post.unpublished']) {
      expect(contentEventSchema.parse({ event, post })).toEqual({
        event,
        post,
      });
    }
    expect(
      contentEventSchema.parse({ event: 'home.updated', extra: true }),
    ).toEqual({ event: 'home.updated' });
    expect(
      contentEventSchema.parse({
        event: 'post.updated',
        post: { ...post, previousSlug: 'old' },
      }),
    ).toEqual({ event: 'post.updated', post });
  });

  it.each([
    { event: 'post.deleted', post },
    { event: 'post.published' },
    { event: 'post.published', post: { ...post, number: 0 } },
    { event: 'post.published', post: { ...post, number: 4.2 } },
    { event: 'post.published', post: { ...post, number: '42' } },
    { event: 'post.published', post: { ...post, slug: '' } },
    { post },
  ])('невідома подія чи не та форма (%j) — відмова', (body) => {
    expect(contentEventSchema.safeParse(body).success).toBe(false);
  });
});

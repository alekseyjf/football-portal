import { webhookSignature } from './webhook-signature';

describe('webhookSignature — HMAC-SHA256 від `{timestamp}.{тіло}` (D57)', () => {
  // Вектор пораховано незалежно (`openssl dgst -sha256 -hmac`); той самий перевіряє web (M1.8.3) — формат підпису
  // — контракт між застосунками
  it('відомий вектор', () => {
    expect(
      webhookSignature({
        secret: 'revalidate-secret-revalidate-secret',
        timestamp: 1_793_368_800,
        body: '{"event":"post.published","post":{"id":"post-1","number":42,"slug":"arsenal-win-the-derby"}}',
      }),
    ).toBe(
      'sha256=632534c58b07648847fd0c50b19f728b3866b0afdb4a129d474a4661b796076a',
    );
  });

  it('інший час чи інше тіло — інший підпис: старий запит з новим часом не пройде', () => {
    const base = { secret: 'revalidate-secret-revalidate-secret', body: '{}' };
    expect(webhookSignature({ ...base, timestamp: 1 })).not.toBe(
      webhookSignature({ ...base, timestamp: 2 }),
    );
    expect(webhookSignature({ ...base, timestamp: 1 })).not.toBe(
      webhookSignature({ ...base, timestamp: 1, body: '{ }' }),
    );
  });
});

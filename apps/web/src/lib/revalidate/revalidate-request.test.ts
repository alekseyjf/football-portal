import { signRevalidatePayload } from '@football-portal/validation/webhook';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleRevalidateRequest,
  REVALIDATE_BODY_MAX_BYTES,
  type RevalidateTag,
} from './revalidate-request';

const SECRET = 'revalidate-secret-revalidate-secret';
const PREVIOUS_SECRET = 'previous-secret-previous-secret-previous';
const NOW_SECONDS = 1_793_368_800;
const PUBLISHED_BODY =
  '{"event":"post.published","post":{"id":"post-1","number":42,"slug":"arsenal-win-the-derby"}}';

type SignedRequest = {
  body?: string;
  secret?: string;
  timestamp?: number;
  headers?: Record<string, string>;
};

function webhookRequest(options: SignedRequest = {}): Request {
  const body = options.body ?? PUBLISHED_BODY;
  const timestamp = options.timestamp ?? NOW_SECONDS;
  const signature = signRevalidatePayload({
    secret: options.secret ?? SECRET,
    timestamp,
    body,
  });
  return new Request('http://localhost:3000/api/revalidate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Revalidate-Timestamp': String(timestamp),
      'X-Revalidate-Signature': signature,
      ...options.headers,
    },
    body,
  });
}

describe('Вебхук API: POST /api/revalidate (D57)', () => {
  let revalidated: Parameters<RevalidateTag>[];
  let warnSpy: ReturnType<typeof vi.spyOn>;

  function handle(request: Request, secrets: readonly string[] = [SECRET]) {
    return handleRevalidateRequest(request, {
      secrets,
      nowSeconds: NOW_SECONDS,
      revalidateTag: (tag, profile) => revalidated.push([tag, profile]),
    });
  }

  beforeEach(() => {
    revalidated = [];
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warnSpy.mockRestore());

  it('без REVALIDATE_SECRET — 404: маршруту наче немає', async () => {
    const response = await handle(webhookRequest(), []);
    expect(response.status).toBe(404);
    expect(revalidated).toEqual([]);
  });

  it('новина вийшла — сторінки негайно (`expire: 0`), sitemap-и — `max`; у відповіді — теги', async () => {
    const response = await handle(webhookRequest());
    expect(response.status).toBe(200);
    expect(revalidated).toEqual([
      ['post:42', { expire: 0 }],
      ['posts:feed', { expire: 0 }],
      ['home', { expire: 0 }],
      ['sitemap:index', 'max'],
      ['sitemap:months', 'max'],
      ['sitemap:news', 'max'],
    ]);
    expect(await response.json()).toEqual({
      revalidated: [
        'post:42',
        'posts:feed',
        'home',
        'sitemap:index',
        'sitemap:months',
        'sitemap:news',
      ],
    });
  });

  it('правка й зняття новини — ті самі теги; закріплення головної — лише `home`', async () => {
    for (const event of ['post.updated', 'post.unpublished']) {
      revalidated = [];
      const body = PUBLISHED_BODY.replace('post.published', event);
      expect((await handle(webhookRequest({ body }))).status).toBe(200);
      expect(revalidated.map(([tag]) => tag)).toEqual([
        'post:42',
        'posts:feed',
        'home',
        'sitemap:index',
        'sitemap:months',
        'sitemap:news',
      ]);
    }

    revalidated = [];
    const response = await handle(
      webhookRequest({ body: '{"event":"home.updated"}' }),
    );
    expect(response.status).toBe(200);
    expect(revalidated).toEqual([['home', { expire: 0 }]]);
  });

  it.each([
    [
      'без підпису',
      {
        headers: { 'X-Revalidate-Signature': '', 'X-Revalidate-Timestamp': '' },
      },
    ],
    ['чужий секрет', { secret: PREVIOUS_SECRET }],
    ['старий час (6 хв тому)', { timestamp: NOW_SECONDS - 360 }],
    ['час з майбутнього (+6 хв)', { timestamp: NOW_SECONDS + 360 }],
  ])(
    '%s → 401, кеш не чіпаємо; у лозі — причина, без тіла й підпису',
    async (_case, options: SignedRequest) => {
      const request = webhookRequest(options);
      const signature = request.headers.get('X-Revalidate-Signature');
      const response = await handle(request);

      expect(response.status).toBe(401);
      expect(revalidated).toEqual([]);
      const logged = warnSpy.mock.calls.flat().join(' ');
      expect(logged).toMatch(/^Revalidate webhook rejected: /);
      expect(logged).not.toContain('arsenal');
      if (signature) expect(logged).not.toContain(signature);
    },
  );

  it('не JSON і без підпису → 401, а не 400: тіло не розбираємо, доки підпис не перевірено', async () => {
    const request = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      body: '{not json',
    });
    expect((await handle(request)).status).toBe(401);
  });

  it('тіло змінили після підпису → 401', async () => {
    const signed = webhookRequest();
    const tampered = new Request(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: PUBLISHED_BODY.replace('"number":42', '"number":43'),
    });
    expect((await handle(tampered)).status).toBe(401);
    expect(revalidated).toEqual([]);
  });

  it('ротація: підпис попереднім секретом приймаємо, поки він у REVALIDATE_SECRET_PREVIOUS', async () => {
    const request = webhookRequest({ secret: PREVIOUS_SECRET });
    expect((await handle(request, [SECRET, PREVIOUS_SECRET])).status).toBe(200);
  });

  it.each([
    ['не JSON', 'not json'],
    [
      'невідома подія',
      '{"event":"post.deleted","post":{"id":"p","number":1,"slug":"s"}}',
    ],
    ['без новини', '{"event":"post.published"}'],
  ])('%s, але підпис правильний → 400, кеш не чіпаємо', async (_case, body) => {
    expect((await handle(webhookRequest({ body }))).status).toBe(400);
    expect(revalidated).toEqual([]);
  });

  it('тіло понад межу → 413, ще до перевірки підпису', async () => {
    const body = `{"event":"home.updated","padding":"${'x'.repeat(REVALIDATE_BODY_MAX_BYTES)}"}`;
    expect((await handle(webhookRequest({ body }))).status).toBe(413);
    expect(revalidated).toEqual([]);
  });
});

import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { PostStatus, Role } from '@prisma/client';
import type request from 'supertest';
import { ScheduledPostPublisher } from '../../src/posts/scheduled-post-publisher.service';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';

const WEBHOOK_SECRET = 'e2e-revalidate-secret-e2e-revalidate-secret';
const POLL_ATTEMPTS = 300;
const POLL_MS = 20;
/** Повільний сайт відповідає пізніше за таймаут вебхука (3 с) */
const SLOW_WEB_DELAY_MS = 5000;

const POST_EN = {
  languageCode: 'en',
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  content: 'The hosts scored in stoppage time to take all three points.',
};

interface WebhookCall {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  body: unknown;
}

interface CreatedPost {
  id: string;
  number: number;
  slug: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<Value>(
  read: () => Value | undefined,
  description: string,
): Promise<Value> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const value = read();
    if (value !== undefined) return value;
    await sleep(POLL_MS);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

/**
 * Вебхук web (D57): подія новини → `POST /api/revalidate`, підписаний HMAC від `{timestamp}.{тіло}` — сам секрет не
 * йде; запис не чекає вебхука, збій сайту — лише в лог. Замість web — локальний HTTP-сервер, що записує запити.
 */
describe('Сповіщення сайту: вебхук web (D57)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let webServer: Server;
  let webhookCalls: WebhookCall[];
  let webAnswersStatus: number;
  let webDelayMs: number;
  let warnSpy: jest.SpyInstance;

  function warningsWith(text: string): string[] {
    return warnSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .filter((message) => message.includes(text));
  }

  async function createPost(fields: object): Promise<CreatedPost> {
    const response = await admin
      .post(apiPath('/posts'))
      .send({ translations: [POST_EN], ...fields })
      .expect(201);
    return response.body as CreatedPost;
  }

  beforeAll(async () => {
    webServer = createServer((req, res) => {
      let rawBody = '';
      req.on('data', (chunk: Buffer) => {
        rawBody += chunk.toString();
      });
      req.on('end', () => {
        webhookCalls.push({
          headers: req.headers,
          rawBody,
          body: JSON.parse(rawBody) as unknown,
        });
        setTimeout(() => res.writeHead(webAnswersStatus).end(), webDelayMs);
      });
    });
    await new Promise<void>((resolve) =>
      webServer.listen(0, '127.0.0.1', resolve),
    );
    const { port } = webServer.address() as AddressInfo;

    e2e = await createE2eApp({
      envOverrides: {
        WEB_REVALIDATE_URL: `http://127.0.0.1:${port}/api/revalidate`,
        REVALIDATE_SECRET: WEBHOOK_SECRET,
      },
    });
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
  });
  afterAll(async () => {
    await e2e.close();
    webServer.closeAllConnections();
    await new Promise((resolve) => webServer.close(resolve));
  });
  beforeEach(() => {
    webhookCalls = [];
    webAnswersStatus = 200;
    webDelayMs = 0;
    // Попередження підписника (збій сайту) — перевіряємо, а не друкуємо в зелений прогін
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => warnSpy.mockRestore());

  it('публікація, правка й зняття — підписаний запит: HMAC від `{timestamp}.{тіло}`, свіжий час, секрету в заголовках немає', async () => {
    const post = await createPost({ status: 'PUBLISHED' });
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ translations: [{ ...POST_EN, title: 'Arsenal edge Chelsea' }] })
      .expect(200);
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ status: 'ARCHIVED' })
      .expect(200);
    const calls = await waitFor(
      () => (webhookCalls.length >= 3 ? webhookCalls : undefined),
      'three webhook calls',
    );

    const postRef = { id: post.id, number: post.number, slug: post.slug };
    expect(calls.map((call) => call.body)).toEqual([
      { event: 'post.published', post: postRef },
      { event: 'post.updated', post: postRef },
      { event: 'post.unpublished', post: postRef },
    ]);
    for (const call of calls) {
      const timestamp = String(call.headers['x-revalidate-timestamp']);
      const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
        .update(`${timestamp}.${call.rawBody}`)
        .digest('hex');
      expect(call.headers['x-revalidate-signature']).toBe(
        `sha256=${expectedSignature}`,
      );
      expect(Math.abs(Date.now() / 1000 - Number(timestamp))).toBeLessThan(60);
      expect(call.headers.authorization).toBeUndefined();
      expect(JSON.stringify(call.headers)).not.toContain(WEBHOOK_SECRET);
    }
  });

  it('воркер розкладу — той самий вебхук, що й ручна публікація', async () => {
    const post = await createPost({
      status: 'SCHEDULED',
      publishedAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await e2e.prisma.post.update({
      where: { id: post.id },
      data: { publishedAt: new Date(Date.now() - 60_000) },
    });

    await e2e.app.get(ScheduledPostPublisher).publishDue(new Date());
    const [call] = await waitFor(
      () => (webhookCalls.length > 0 ? webhookCalls : undefined),
      'webhook call',
    );
    expect(call.body).toEqual({
      event: 'post.published',
      post: { id: post.id, number: post.number, slug: post.slug },
    });
  });

  it('сайт відповів 500 — публікація відбулась, у лозі причина без секрету', async () => {
    webAnswersStatus = 500;
    const post = await createPost({ status: 'PUBLISHED' });
    const [warning] = await waitFor(() => {
      const warnings = warningsWith('web answered 500');
      return warnings.length > 0 ? warnings : undefined;
    }, 'webhook failure warning');

    expect(
      (await e2e.prisma.post.findUniqueOrThrow({ where: { id: post.id } }))
        .status,
    ).toBe(PostStatus.PUBLISHED);
    expect(warning).toContain(`post.published новини ${post.number}`);
    expect(warning).not.toContain(WEBHOOK_SECRET);
  });

  it('повільний сайт: збереження вебхука не чекає, а сам запит обривається за 3 с', async () => {
    webDelayMs = SLOW_WEB_DELAY_MS;
    const startedAt = Date.now();
    const post = await createPost({ status: 'PUBLISHED' });
    const savedInMs = Date.now() - startedAt;
    await waitFor(
      () => (webhookCalls.length > 0 ? webhookCalls : undefined),
      'webhook call',
    );

    // Відповідь API — без очікування сайту (той відповість лише за 5 с)
    expect(savedInMs).toBeLessThan(SLOW_WEB_DELAY_MS / 2);
    const [warning] = await waitFor(() => {
      const warnings = warningsWith('TimeoutError');
      return warnings.length > 0 ? warnings : undefined;
    }, 'webhook timeout warning');
    expect(warning).toContain(`post.published новини ${post.number}`);
    expect(Date.now() - startedAt).toBeLessThan(SLOW_WEB_DELAY_MS);
  });
});

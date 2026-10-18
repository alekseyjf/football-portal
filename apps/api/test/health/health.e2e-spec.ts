import { createServer, type AddressInfo, type Socket } from 'node:net';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { expectMatchesContract } from '../support/openapi-contract';

/** Таймаут пінгу в `HealthController` — 3 с; запас — на старт з'єднання й відповідь. */
const HEALTH_RESPONSE_DEADLINE_MS = 5000;

function databaseUrlOnPort(port: number): string {
  return `postgresql://e2e:e2e@127.0.0.1:${port}/e2e`;
}

/** Порт, на якому ніхто не слухає: з'єднання відхиляється одразу. */
async function findClosedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

/** TCP-сервер, що приймає з'єднання й мовчить, — як «мертвий» сокет пулера (OQ-11). */
async function startSilentServer() {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    stop: () => {
      for (const socket of sockets) socket.destroy();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe('GET /health', () => {
  describe('БД працює', () => {
    let e2e: E2eApp;
    beforeAll(async () => {
      e2e = await createE2eApp();
    });
    afterAll(() => e2e.close());

    it('200 і статус БД; відповідь не кешується', async () => {
      const response = await request(e2e.app.getHttpServer())
        .get(apiPath('/health'))
        .expect(200);
      expect(response.body).toEqual({
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      });
      expect(response.headers['cache-control']).toContain('no-store');
      expectMatchesContract(response, 'get', '/health');
    });
  });

  describe('БД відхиляє з’єднання', () => {
    let e2e: E2eApp;
    beforeAll(async () => {
      e2e = await createE2eApp({
        unavailableDatabaseUrl: databaseUrlOnPort(await findClosedPort()),
      });
    });
    afterAll(() => e2e.close());

    it('503 лише зі статусом — без адреси сервера й тексту помилки', async () => {
      const response = await request(e2e.app.getHttpServer())
        .get(apiPath('/health'))
        .expect(503);
      expect(response.body).toEqual({
        status: 'error',
        info: {},
        error: { database: { status: 'down' } },
        details: { database: { status: 'down' } },
      });
      expectMatchesContract(response, 'get', '/health');
    });
  });

  describe('БД не відповідає', () => {
    let e2e: E2eApp;
    let silentServer: Awaited<ReturnType<typeof startSilentServer>>;
    beforeAll(async () => {
      silentServer = await startSilentServer();
      e2e = await createE2eApp({
        unavailableDatabaseUrl: databaseUrlOnPort(silentServer.port),
      });
    });
    afterAll(async () => {
      // Спершу рвемо завислі з'єднання — інакше пул Prisma чекав би їх при закритті
      await silentServer.stop();
      await e2e.close();
    });

    it('503 за таймаутом пінгу, а не зависання разом з БД', async () => {
      const startedAt = Date.now();
      const response = await request(e2e.app.getHttpServer())
        .get(apiPath('/health'))
        .expect(503);
      expect(Date.now() - startedAt).toBeLessThan(HEALTH_RESPONSE_DEADLINE_MS);
      expect(response.body).toMatchObject({
        status: 'error',
        error: { database: { status: 'down' } },
      });
    });
  });
});

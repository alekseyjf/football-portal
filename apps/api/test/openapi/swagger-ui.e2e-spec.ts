import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { openApiDocument } from '../support/openapi-contract';

interface ServedDocument {
  openapi: string;
  info: { title: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, unknown>>;
}

function listOperations(paths: Record<string, Record<string, unknown>>) {
  return Object.entries(paths)
    .flatMap(([path, operations]) =>
      Object.keys(operations).map(
        (method) => `${method.toUpperCase()} ${path}`,
      ),
    )
    .sort();
}

describe('Swagger UI (D28)', () => {
  describe('локально й у тестах', () => {
    let e2e: E2eApp;
    beforeAll(async () => {
      e2e = await createE2eApp();
    });
    afterAll(() => e2e.close());

    it('/api/docs — UI, /api/docs-json — документ; ендпоінти ті самі, що в згенерованому openapi.json', async () => {
      const ui = await request(e2e.app.getHttpServer())
        .get('/api/docs')
        .expect(200);
      expect(ui.text).toContain('swagger-ui');

      const response = await request(e2e.app.getHttpServer())
        .get('/api/docs-json')
        .expect(200);
      const servedDocument = response.body as ServedDocument;
      expect(servedDocument).toMatchObject({
        info: { title: '12Yards API' },
        servers: [{ url: apiPath('') }],
      });
      // Схем DTO тут немає (ts-jest збирає без CLI-плагіна), а набір ендпоінтів — той самий:
      // документ застарів (новий ендпоінт без `pnpm gen:api-types`) — тест падає
      expect(listOperations(servedDocument.paths)).toEqual(
        listOperations(openApiDocument().paths),
      );
    });
  });

  describe('на проді', () => {
    let e2e: E2eApp;
    beforeAll(async () => {
      e2e = await createE2eApp({
        envOverrides: {
          NODE_ENV: 'production',
          TRUST_PROXY: '1',
          CORS_ORIGINS: 'https://12yards.example',
        },
      });
    });
    afterAll(() => e2e.close());

    it('UI і документа немає — 404, а API працює', async () => {
      const server = e2e.app.getHttpServer();
      await request(server).get('/api/docs').expect(404);
      await request(server).get('/api/docs-json').expect(404);
      await request(server).get(apiPath('/football/leagues')).expect(200);
    });
  });
});

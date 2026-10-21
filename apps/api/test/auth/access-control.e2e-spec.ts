import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import {
  expectMatchesContract,
  openApiDocument,
  type HttpMethod,
} from '../support/openapi-contract';

interface Route {
  method: HttpMethod;
  /** Як у документі: `/posts/{id}` */
  path: string;
}

/** Лише для залогіненого (`@AuthRequired()`, `DELETE /users/me` — свої guard-и). */
const SIGNED_IN_ROUTES: Route[] = [
  { method: 'post', path: '/auth/logout-all' },
  { method: 'post', path: '/comments' },
  { method: 'delete', path: '/comments/{id}' },
  { method: 'post', path: '/likes' },
  { method: 'delete', path: '/users/me' },
];

/** Лише для ADMIN (`@AdminOnly()`). */
const ADMIN_ROUTES: Route[] = [
  { method: 'get', path: '/posts/admin/all' },
  { method: 'get', path: '/posts/admin/{id}' },
  { method: 'post', path: '/posts' },
  { method: 'put', path: '/posts/{id}' },
  { method: 'delete', path: '/posts/{id}' },
  { method: 'get', path: '/tags/admin/all' },
  { method: 'post', path: '/tags' },
  { method: 'put', path: '/tags/{id}' },
  { method: 'delete', path: '/tags/{id}' },
  { method: 'delete', path: '/comments/{id}/purge' },
  { method: 'delete', path: '/comments/{id}/purge-thread' },
  { method: 'post', path: '/football/sync' },
  { method: 'get', path: '/football/sync-runs' },
  { method: 'delete', path: '/users/{id}' },
];

const PROTECTED_ROUTES = [...SIGNED_IN_ROUTES, ...ADMIN_ROUTES];

function routeName({ method, path }: Route): string {
  return `${method.toUpperCase()} ${path}`;
}

/** Параметри шляху — неіснуючий id: guard відповідає раніше, ніж до нього дійде сервіс. */
function concretePath(path: string): string {
  return apiPath(path.replace(/\{[^}]+\}/g, 'missing-id'));
}

function send(agent: request.Agent | ReturnType<typeof request>, route: Route) {
  return agent[route.method](concretePath(route.path)).send({});
}

describe('Доступ до роутів: guard-и й документ OpenAPI', () => {
  let e2e: E2eApp;
  let userAgent: request.Agent;
  let adminAgent: request.Agent;

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    userAgent = await loginAs(e2e, await createUser(e2e));
    adminAgent = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
  });
  afterAll(() => e2e.close());

  it('у документі сесію (cookie) вимагають рівно ці роути', () => {
    const documentedProtected = Object.entries(openApiDocument().paths)
      .flatMap(([path, operations]) =>
        Object.entries(operations).map(([method, operation]) => ({
          route: { method: method as HttpMethod, path },
          security: operation?.security,
        })),
      )
      .filter(
        ({ security }) =>
          security?.some((requirement) => 'cookie' in requirement) &&
          !security.some(
            (requirement) => Object.keys(requirement).length === 0,
          ),
      )
      .map(({ route }) => routeName(route))
      .sort();
    expect(documentedProtected).toEqual(PROTECTED_ROUTES.map(routeName).sort());
  });

  it('гість → 401 на кожному захищеному роуті', async () => {
    for (const route of PROTECTED_ROUTES) {
      const response = await send(request(e2e.app.getHttpServer()), route);
      expect({ route: routeName(route), status: response.status }).toEqual({
        route: routeName(route),
        status: 401,
      });
      expectMatchesContract(response, route.method, route.path);
    }
  });

  it('USER → 403 на роутах адміна', async () => {
    for (const route of ADMIN_ROUTES) {
      const response = await send(userAgent, route);
      expect({ route: routeName(route), status: response.status }).toEqual({
        route: routeName(route),
        status: 403,
      });
      expectMatchesContract(response, route.method, route.path);
    }
  });

  it('ADMIN проходить guard; відповідь (зокрема помилка) — задокументована', async () => {
    for (const route of ADMIN_ROUTES) {
      const response = await send(adminAgent, route);
      const isGuardPassed = ![401, 403].includes(response.status);
      expect({ route: routeName(route), isGuardPassed }).toEqual({
        route: routeName(route),
        isGuardPassed: true,
      });
      expectMatchesContract(response, route.method, route.path);
    }
  });
});

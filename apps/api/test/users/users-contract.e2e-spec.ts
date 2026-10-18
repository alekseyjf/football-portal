import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

/** Відповіді видалення акаунтів — за `packages/types/openapi.json` (D28). */
describe('Видалення акаунта: відповіді за контрактом OpenAPI', () => {
  let e2e: E2eApp;
  let admin: request.Agent;

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
  });
  afterAll(() => e2e.close());

  it('свій акаунт: невірний пароль → 403, вірний → 200', async () => {
    const member = await createUser(e2e);
    const memberAgent = await loginAs(e2e, member);

    const wrongPassword = await memberAgent
      .delete(apiPath('/users/me'))
      .send({ password: 'not-my-password' })
      .expect(403);
    expectMatchesContract(wrongPassword, 'delete', '/users/me');

    const deleted = await memberAgent
      .delete(apiPath('/users/me'))
      .send({ password: member.password })
      .expect(200);
    expectMatchesContract(deleted, 'delete', '/users/me');
  });

  it('адмін видаляє користувача; повторно — 409', async () => {
    const member = await createUser(e2e);
    const deleted = await admin
      .delete(apiPath(`/users/${member.id}`))
      .send({ note: 'spam' })
      .expect(200);
    expectMatchesContract(deleted, 'delete', '/users/{id}');
    expect(deleted.body).toMatchObject({ userId: member.id });

    const repeated = await admin
      .delete(apiPath(`/users/${member.id}`))
      .send({})
      .expect(409);
    expectMatchesContract(repeated, 'delete', '/users/{id}');
  });
});

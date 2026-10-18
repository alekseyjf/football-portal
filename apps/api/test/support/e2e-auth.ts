import { randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, type E2eApp } from './e2e-app';

/** Пароль тестових користувачів — у межах правил реєстрації (8…72 байти). */
const E2E_PASSWORD = 'e2e-password-1';

export interface E2eUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Користувач через `POST /auth/register` — так само, як справжній (профіль, нормалізація пошти);
 * ADMIN — роллю в БД, бо через API адмінів не створюють. Ліміт реєстрацій — 5 за 10 хв з IP
 * на застосунок, тож у файлі тестів — до 5 користувачів. `.test` — зарезервований домен (RFC 2606).
 */
export async function createUser(
  e2e: E2eApp,
  role: Role = Role.USER,
): Promise<E2eUser> {
  const email = `${role.toLowerCase()}-${randomUUID()}@example.test`;
  const response = await request(e2e.app.getHttpServer())
    .post(apiPath('/auth/register'))
    .send({ email, name: `E2E ${role}`, password: E2E_PASSWORD })
    .expect(201);
  const { id } = (response.body as { user: { id: string } }).user;
  if (role !== Role.USER) {
    await e2e.prisma.user.update({ where: { id }, data: { role } });
  }
  return { id, email, password: E2E_PASSWORD };
}

/**
 * Значення cookie з `Set-Cookie` відповіді — для тестів, де браузер шле лише частину cookies
 * (access уже прострочений, refresh — ні). Порожнє значення — це очищення, не cookie.
 */
export function readSetCookie(
  response: request.Response,
  cookieName: string,
): string {
  const setCookieHeader = response.headers['set-cookie'] as unknown;
  const setCookies = Array.isArray(setCookieHeader)
    ? (setCookieHeader as string[])
    : [];
  const cookieValue = setCookies
    .map((setCookie) => setCookie.split(';')[0])
    .filter((pair) => pair.startsWith(`${cookieName}=`))
    .map((pair) => pair.slice(cookieName.length + 1))
    .find((value) => value !== '');
  if (!cookieValue) throw new Error(`No ${cookieName} cookie in the response`);
  return cookieValue;
}

/** Агент supertest зберігає httpOnly cookies логіну й шле їх далі — як браузер. */
export async function loginAs(
  e2e: E2eApp,
  user: E2eUser,
): Promise<request.Agent> {
  const agent = request.agent(e2e.app.getHttpServer());
  await agent
    .post(apiPath('/auth/login'))
    .send({ email: user.email, password: user.password })
    .expect(200);
  return agent;
}

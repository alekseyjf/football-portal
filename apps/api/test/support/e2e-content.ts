import type request from 'supertest';
import { apiPath } from './e2e-app';

/** Мінімальний валідний переклад default-мови. */
const POST_TRANSLATION_EN = {
  languageCode: 'en',
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  content: 'The hosts scored in stoppage time to take all three points.',
};

/** Опублікована новина — через API адміном, як в адмінці. */
export async function publishPost(
  admin: request.Agent,
): Promise<{ id: string; number: number }> {
  const response = await admin
    .post(apiPath('/posts'))
    .send({ status: 'PUBLISHED', translations: [POST_TRANSLATION_EN] })
    .expect(201);
  return response.body as { id: string; number: number };
}

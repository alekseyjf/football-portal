import { forwardToApi } from '@football-portal/validation/site-gateway';
import { apiProxyTarget } from '@/lib/env/server-env';

/**
 * Шлюз до API (M1.11.3, D59): браузер ходить лише на домен сайту — `/api/v1/*` (і Swagger `/api/docs` на тесті), а сервер
 * сайту пересилає запит на API з секретом і IP браузера. Тож cookies сесії — на домені сайту, а API напряму закритий.
 * Пароль тест-сервера перевіряє `proxy.ts`; вебхук `/api/revalidate` — свій маршрут, сюди не потрапляє.
 */
function proxyToApi(request: Request): Promise<Response> {
  return forwardToApi(request, apiProxyTarget());
}

export {
  proxyToApi as DELETE,
  proxyToApi as GET,
  proxyToApi as PATCH,
  proxyToApi as POST,
  proxyToApi as PUT,
};

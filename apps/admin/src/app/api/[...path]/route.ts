import { forwardToApi } from '@football-portal/validation/site-gateway';
import { apiProxyTarget } from '@/lib/env/server-env';

/**
 * Шлюз до API (M1.11.3, D59): браузер ходить лише на домен адмінки (`/api/v1/*`), а сервер адмінки пересилає запит на API
 * з секретом і IP браузера — cookies сесії на домені адмінки, API напряму закритий. Пароль тест-сервера — `proxy.ts`.
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

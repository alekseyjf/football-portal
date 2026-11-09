import { isIP } from 'node:net';
import { CLIENT_IP_HEADER, ORIGIN_SECRET_HEADER } from '../api-access';
import { secretsEqual } from './secrets';

/**
 * Заголовки браузера, потрібні API: сесія (`cookie`), мова, перевірка CSRF (`origin`, `sec-fetch-site`, D60), тип тіла.
 * Решта до API не йде: `authorization` — пароль Basic Auth тест-сервера, `host` і `x-forwarded-*` — адреса сайту.
 */
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'cookie',
  'origin',
  'sec-fetch-site',
  'user-agent',
] as const;

/**
 * Не пересилаємо: `fetch` уже розпакував тіло (`content-encoding` збрехав би браузеру) і довжину порахує сервер сайту;
 * решта — про з'єднання з API, а не з браузером.
 */
const DROPPED_RESPONSE_HEADERS: ReadonlySet<string> = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
]);

const METHODS_WITHOUT_BODY: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/**
 * Скільки сервер сайту чекає API. Із запасом на прокидання Render Free (~1 хв, D58) і менше за межу функції Vercel —
 * інакше браузер отримав би сторінку помилки платформи замість JSON.
 */
export const API_PROXY_TIMEOUT_MS = 90_000;

/** Код помилки шлюзу: API не відповів чи не встиг (502 / 504) — сайт показує загальну помилку. */
export const API_UNAVAILABLE = 'API_UNAVAILABLE';

export interface ApiProxyTarget {
  /** `https://….onrender.com` — origin без шляху */
  apiOrigin: string;
  /** Без секрету — лише локально: API без `API_ORIGIN_SECRET` його не перевіряє */
  originSecret: string | undefined;
}

/**
 * Route Handler сайту й адмінки `app/api/[...path]` (M1.11.3, D59): той самий шлях і query — на API, з секретом сервера
 * й IP браузера; відповідь — як є, з усіма `Set-Cookie` (сесія живе на домені сайту). Rewrites Next цього не вміють:
 * заголовок запиту до зовнішньої адреси rewrite не додає.
 */
export async function forwardToApi(
  request: Request,
  target: ApiProxyTarget,
  timeoutMs: number = API_PROXY_TIMEOUT_MS,
): Promise<Response> {
  const { pathname, search } = new URL(request.url);
  try {
    const apiResponse = await fetch(
      new URL(`${pathname}${search}`, target.apiOrigin),
      {
        method: request.method,
        headers: apiRequestHeaders(request.headers, target.originSecret),
        // Тіла API — JSON до 1 МБ (`JSON_BODY_LIMIT`): простіше прочитати ціле, ніж стрімити з `duplex`
        body: METHODS_WITHOUT_BODY.has(request.method)
          ? undefined
          : await request.arrayBuffer(),
        // Редирект — справа браузера, а не сервера сайту
        redirect: 'manual',
        cache: 'no-store',
        // Браузер закрив вкладку — не чекаємо API даремно
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(timeoutMs),
        ]),
      },
    );
    return new Response(apiResponse.body, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: browserResponseHeaders(apiResponse.headers),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    console.error(
      `API proxy ${request.method} ${pathname}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return apiUnavailableResponse(isTimeout ? 504 : 502);
  }
}

/**
 * IP браузера — перший у `x-forwarded-for`. На Vercel він єдиний: платформа переписує заголовок, і клієнт його не
 * підробить. `next start` ставить адресу сокета, лише коли заголовка немає (`??=`, Next 16.4): поза Vercel клієнт
 * підставить будь-який IP — власний сервер (M3.1) має брати IP від свого reverse proxy.
 */
export function clientIpOf(headers: Headers): string | null {
  const firstForwardedIp = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return firstForwardedIp && isIP(firstForwardedIp) !== 0
    ? firstForwardedIp
    : null;
}

/** Запит прийшов від сервера сайту чи адмінки (API, D59). */
export function isOriginSecretValid(
  providedSecret: string | undefined,
  originSecret: string,
): boolean {
  return (
    providedSecret !== undefined && secretsEqual(providedSecret, originSecret)
  );
}

function apiRequestHeaders(
  browserHeaders: Headers,
  originSecret: string | undefined,
): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = browserHeaders.get(name);
    if (value !== null) headers.set(name, value);
  }
  const clientIp = clientIpOf(browserHeaders);
  if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp);
  if (originSecret) headers.set(ORIGIN_SECRET_HEADER, originSecret);
  return headers;
}

/** `Set-Cookie` перебір `Headers` віддає кожен окремо (Fetch, `getSetCookie`) — жоден cookie сесії не губиться. */
function browserResponseHeaders(apiHeaders: Headers): Headers {
  const headers = new Headers();
  for (const [name, value] of apiHeaders) {
    if (!DROPPED_RESPONSE_HEADERS.has(name)) headers.append(name, value);
  }
  return headers;
}

/** Тіло — у форматі помилок API (`statusCode`, `message`), щоб клієнт сайту розібрав його так само. */
function apiUnavailableResponse(status: 502 | 504): Response {
  return Response.json(
    { statusCode: status, message: API_UNAVAILABLE },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

import type { RequestHandler } from 'express';
import { rejectRequest } from './reject-request';

/** Мутацію відправила сторінка чужого сайту (CSRF, D60). */
export const CROSS_SITE_REQUEST_FORBIDDEN = 'CROSS_SITE_REQUEST_FORBIDDEN';
/** Тіло мутації — не JSON: так шлють HTML-форми, а клієнти API — завжди JSON. */
export const UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE';

const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);
const JSON_MEDIA_TYPE = 'application/json';

/** Те, з чого видно, звідки мутація, — заголовки як прийшли (через шлюз сайту — пересланий браузерний). */
export interface MutationOrigin {
  method: string;
  origin: string | undefined;
  /** Fetch Metadata: `same-origin` | `same-site` | `cross-site` | `none`; старі браузери не шлють */
  secFetchSite: string | undefined;
  contentType: string | undefined;
  hasBody: boolean;
}

export type CrossSiteViolation =
  | { status: 403; code: typeof CROSS_SITE_REQUEST_FORBIDDEN }
  | { status: 415; code: typeof UNSUPPORTED_MEDIA_TYPE };

/**
 * Захист від CSRF поверх `SameSite` (OQ-6 → D60; OWASP: Fetch Metadata + перевірка Origin). Читання (GET) нічого не
 * змінює — його не чіпаємо. Мутація:
 * - `Sec-Fetch-Site: same-origin` — зі сторінки того самого origin (сайт через свій проксі, Swagger UI API) — так;
 * - `cross-site` чи `Origin` поза списком сайту й адмінки (`CORS_ORIGINS`) — 403;
 * - без обох заголовків — не браузер (curl, тести, сервер): CSRF — атака через чужий браузер, а браузер мутацію з
 *   іншого сайту без `Origin` не шле;
 * - тіло чи `Content-Type` — лише JSON (415): HTML-форма чужого сайту JSON надіслати не може, а запит без тіла (refresh,
 *   logout) типу не має.
 */
export function findCrossSiteViolation(
  request: MutationOrigin,
  allowedOrigins: ReadonlySet<string>,
): CrossSiteViolation | null {
  if (!MUTATING_METHODS.has(request.method)) return null;
  if (!isSameSiteRequest(request, allowedOrigins)) {
    return { status: 403, code: CROSS_SITE_REQUEST_FORBIDDEN };
  }
  const declaresBody = request.hasBody || request.contentType !== undefined;
  if (declaresBody && mediaTypeOf(request.contentType) !== JSON_MEDIA_TYPE) {
    return { status: 415, code: UNSUPPORTED_MEDIA_TYPE };
  }
  return null;
}

function isSameSiteRequest(
  request: MutationOrigin,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (request.secFetchSite === 'same-origin') return true;
  if (request.secFetchSite === 'cross-site') return false;
  return request.origin === undefined || allowedOrigins.has(request.origin);
}

/** `application/json; charset=utf-8` → `application/json` */
function mediaTypeOf(contentType: string | undefined): string | undefined {
  return contentType?.split(';')[0]?.trim().toLowerCase();
}

/** Middleware до розбору тіла й роутингу: відмова — без читання тіла. */
export function createCrossSiteRequestGuard(
  allowedOrigins: readonly string[],
): RequestHandler {
  const allowedOriginSet: ReadonlySet<string> = new Set(allowedOrigins);
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    const violation = findCrossSiteViolation(
      {
        method: req.method,
        origin: req.get('origin'),
        secFetchSite: req.get('sec-fetch-site'),
        contentType: req.get('content-type'),
        hasBody:
          req.get('transfer-encoding') !== undefined ||
          (contentLength !== undefined && contentLength !== '0'),
      },
      allowedOriginSet,
    );
    if (violation) {
      rejectRequest(res, violation.status, violation.code);
      return;
    }
    next();
  };
}

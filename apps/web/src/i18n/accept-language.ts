import { NextRequest } from 'next/server';

/**
 * У додатку лише сегменти **`en`** та **`ua`** (URL, `messages/ua.json`, `lang` у API).
 * У Accept-Language стандартний код української — **`uk`** (часто `uk-UA`). Замінюємо лише
 * такі **повні** language-range (до `;`), щоб не зачепити випадкові підрядки в інших тегах.
 *
 * Для `Intl` / дат у `content-lang.ts` лишається BCP47 **`uk-UA`** — це не сегмент маршруту.
 */
export function normalizeAcceptLanguageForAppLocales(
  request: NextRequest,
): NextRequest {
  const acceptLanguage = request.headers.get('accept-language');
  if (!acceptLanguage) {
    return request;
  }

  const ranges = acceptLanguage.split(',');
  let changed = false;
  const normalizedRanges = ranges.map((range) => {
    const trimmed = range.trim();
    const semicolon = trimmed.indexOf(';');
    const tagPart =
      semicolon === -1 ? trimmed : trimmed.slice(0, semicolon).trim();
    const params =
      semicolon === -1 ? '' : trimmed.slice(semicolon);

    if (!/^uk(?:-[A-Za-z0-9]+)?$/i.test(tagPart)) {
      return range;
    }
    changed = true;
    const prefix = range.match(/^\s*/)?.[0] ?? '';
    return `${prefix}ua${params}`;
  });

  if (!changed) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set('accept-language', normalizedRanges.join(','));

  return new NextRequest(request.url, {
    headers,
    method: request.method,
  });
}

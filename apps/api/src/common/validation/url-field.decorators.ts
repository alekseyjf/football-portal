import { applyDecorators } from '@nestjs/common';
import {
  MEDIA_URL_PROTOCOLS,
  SOURCE_URL_PROTOCOLS,
  URL_MAX_LENGTH,
} from '@football-portal/validation';
import { IsUrl, MaxLength } from 'class-validator';
import { TrimString } from './trim-string.transform';

/**
 * URL медіа поста (`coverImage`, `videoUrl`): лише `https://` — рендериться в `<img src>` на web,
 * тож `http:` дав би mixed content, а `javascript:` / `data:` — вектор XSS.
 *
 * ⚠️ SSRF: зараз API ці URL **не фетчить**. Щойно бекенд почне їх завантажувати (OG-превʼю,
 * ресайз, `next/image` remotePatterns) — додати перевірку резолвленого IP на приватні / локальні
 * діапазони (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7) і заборону редіректів.
 */
export const IsMediaUrl = () =>
  applyDecorators(
    TrimString(),
    IsUrl({
      protocols: MEDIA_URL_PROTOCOLS,
      require_protocol: true,
      require_valid_protocol: true,
    }),
    MaxLength(URL_MAX_LENGTH),
  );

/** Посилання на джерело новини: http(s), без `javascript:` тощо. */
export const IsSourceUrl = () =>
  applyDecorators(
    TrimString(),
    IsUrl({
      protocols: SOURCE_URL_PROTOCOLS,
      require_protocol: true,
      require_valid_protocol: true,
    }),
    MaxLength(URL_MAX_LENGTH),
  );

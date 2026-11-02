import { applyDecorators } from '@nestjs/common';
import {
  MEDIA_URL_PROTOCOLS,
  normalizeYouTubeUrl,
  parseYouTubeVideoId,
  SOURCE_URL_PROTOCOLS,
  URL_MAX_LENGTH,
} from '@football-portal/validation';
import { Transform } from 'class-transformer';
import { buildMessage, IsUrl, MaxLength, ValidateBy } from 'class-validator';
import { TrimString } from './trim-string.transform';

/**
 * Адреса обкладинки поста (`coverImageUrl`): лише `https://` — рендериться в `<img src>` на web,
 * тож `http:` дав би mixed content, а `javascript:` / `data:` — вектор XSS. Нова адреса — ще й з
 * фотобанку зі списку: це правило сервісу (`resolvePostCoverImage`, `COVER_IMAGE_HOST_NOT_ALLOWED`),
 * бо збережену адресу з іншого хоста `PUT` приймає без змін (M1.8.3a).
 *
 * ⚠️ SSRF: API ці URL **не фетчить**. Оптимізатор сайту (`next/image`) завантажує лише фото
 * фотобанків зі списку (`images.remotePatterns` з `COVER_IMAGE_HOSTS`), без редиректів і без
 * локальних IP (Next за замовчуванням). Щойно бекенд почне фетчити довільні URL (OG-превʼю, імпорт) —
 * перевірка резолвленого IP на приватні / локальні діапазони (127/8, 10/8, 172.16/12, 192.168/16,
 * 169.254/16, ::1, fc00::/7) і заборона редіректів.
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

/**
 * Відео новини (D54) — посилання YouTube у звичних формах (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`; лише
 * https). Зберігається канонічним `https://www.youtube.com/watch?v={id}` — сайт розбирає одну форму. Нормалізація —
 * до валідаторів: посилання не на відео YouTube лишається як є, і його відкидає `isYouTubeVideoUrl`. API за ним нічого
 * не завантажує, а сайт бере прев'ю з фіксованого хоста за id (`i.ytimg.com/vi/{id}/…`) — SSRF тут немає.
 */
export const IsYouTubeVideoUrl = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? (normalizeYouTubeUrl(value) ?? value) : value,
    ),
    MaxLength(URL_MAX_LENGTH),
    ValidateBy({
      name: 'isYouTubeVideoUrl',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && parseYouTubeVideoId(value) !== null,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a YouTube video link: youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… or youtube.com/embed/…`,
        ),
      },
    }),
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

/**
 * Мова контенту — query `lang` у `GET /posts`, `/posts/{number}`, `/tags`, `/tags/{slug}` (`Language.code`, D22).
 * API приймає будь-який рядок (невідома мова → default), тож у схемі мови не перелічено — тут мови, якими працює web.
 */
export type ApiContentLanguage = 'en' | 'uk';

/** Default-мова контенту: переклад нею обов'язковий, на неї API робить fallback. */
export const DEFAULT_CONTENT_LANG: ApiContentLanguage = 'en';

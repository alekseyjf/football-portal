/**
 * Спільні правила валідації — єдине джерело чисел для API (class-validator DTO)
 * і форм web / admin (zod-схеми у `@football-portal/validation/forms`).
 * Цей вхід без залежностей: API імпортує лише його, zod йому не потрібен.
 */
import { slugify } from './slug';

export { SLUG_PATTERN, slugify } from './slug';
export { publicTagPath } from './public-paths';
export { normalizeYouTubeUrl, parseYouTubeVideoId } from './youtube';

/** RFC 5321: довша адреса не доставляється. */
export const EMAIL_MAX_LENGTH = 254;

/** Політика для **нового** пароля (реєстрація, згодом — зміна пароля). */
export const PASSWORD_MIN_LENGTH = 8;
/**
 * bcrypt обрізає пароль до 72 **байт** UTF-8 — довший мовчки втратив би хвіст.
 * Межа саме в байтах: кирилиця — 2 байти на літеру, тож 72 символи кирилицею = 144 байти.
 */
export const PASSWORD_MAX_BYTES = 72;
/**
 * Для **введеного** пароля (логін, підтвердження видалення акаунта): без мінімуму —
 * старі акаунти могли зареєструватися за попередньою політикою (6 символів).
 * Максимум — лише захист від величезних тіл (bcrypt сам обрізає до 72 байт).
 */
export const PASSWORD_INPUT_MAX_LENGTH = 256;

/** `UserProfile.displayName` */
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 50;

/** Текст коментаря — після trim. */
export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_MAX_LENGTH = 2000;
/** Порція коментарів (`GET /comments?limit=`, `…/replies?limit=`, D27): сайт бере 20 коренів і 10 відповідей. */
export const COMMENTS_PAGE_LIMIT_MAX = 50;

/** Адреса обкладинки поста (`coverImageUrl`): лише https. Відео — лише YouTube (`parseYouTubeVideoId`, D54). */
export const MEDIA_URL_PROTOCOLS = ['https'];
/** Посилання на джерело новини (`sourceUrl`). */
export const SOURCE_URL_PROTOCOLS = ['http', 'https'];
export const URL_MAX_LENGTH = 2048;
/** Назва джерела новини («BBC Sport»), після trim (D26). */
export const POST_SOURCE_NAME_MAX_LENGTH = 100;

/** Переклад поста — після trim. */
export const POST_TITLE_MIN_LENGTH = 5;
export const POST_TITLE_MAX_LENGTH = 200;
export const POST_EXCERPT_MIN_LENGTH = 10;
export const POST_EXCERPT_MAX_LENGTH = 500;
export const POST_CONTENT_MIN_LENGTH = 20;
export const POST_CONTENT_MAX_LENGTH = 100_000;

/**
 * Обкладинка поста (D44), після trim: опис для незрячих (`alt`) — у кожному перекладі,
 * підпис автора фото — один на пост («Stuart MacFarlane / Getty Images»).
 */
export const POST_COVER_IMAGE_ALT_MAX_LENGTH = 250;
export const POST_COVER_IMAGE_CREDIT_MAX_LENGTH = 100;

/** Slug поста — з EN-заголовка або явний з адмінки (D24). */
export const POST_SLUG_MAX_LENGTH = 80;
const POST_SLUG_FALLBACK = 'post';

/**
 * Slug новини з EN-заголовка (D24): «Mbappé scores!» → `mbappe-scores`. Один на всі мови — мову задає локаль в URL.
 * Заголовок без латиниці — `post`: новину визначає номер, тож slug може бути неунікальним і неточним.
 */
export function slugifyTitle(title: string): string {
  return slugify(title, POST_SLUG_MAX_LENGTH) ?? POST_SLUG_FALLBACK;
}
/** Номер поста в URL `{slug}-{number}` (D24): `Post.number` — Postgres INTEGER. */
export const POST_NUMBER_MAX = 2_147_483_647;

/** Скільки тегів / клубів / турнірів можна прив'язати до одного поста. */
export const POST_RELATION_IDS_MAX = 20;

/** Назва тегу кожною мовою, після trim: коротка тема для чипа («Трансфери», «Звіти з матчів»), D45. */
export const TAG_NAME_MIN_LENGTH = 2;
export const TAG_NAME_MAX_LENGTH = 50;
/** Slug тегу — з EN-назви або явний при створенні; адреса сторінки тегу, не змінюється (D45). */
export const TAG_SLUG_MAX_LENGTH = 50;

/**
 * Slug тегу з EN-назви (D45): «Transfer window» → `transfer-window`. Одна функція для API (slug при створенні) і
 * адмінки (підказка адреси). Без fallback, на відміну від `slugifyTitle`: тег визначає його slug, і всі теги з
 * назвою без латиниці отримали б один — `null`, тоді адресу задають явно.
 */
export function slugifyTagName(name: string): string | null {
  return slugify(name, TAG_SLUG_MAX_LENGTH);
}

/**
 * Номер сторінки в списках (`?page=`): `?page=1e20` → `skip` не влазить в int64 → 500 у Prisma;
 * 100 000 сторінок — з запасом.
 */
export const PAGE_NUMBER_MAX = 100_000;

/** Сторінка публічної стрічки (`GET /posts?limit=`). */
export const POSTS_PAGE_LIMIT_MAX = 50;
/** Значень в одному фільтрі стрічки (`GET /posts?tags=a,b`): тегів, турнірів чи клубів — кожного до 20. */
export const POSTS_FILTER_VALUES_MAX = 20;

/**
 * Код турніру (`PL`, `BL1`) — у фільтрах `GET /posts?competition=` (D46) і `GET /football/matches?league=`, у
 * `/news?competition=` і `?league=` сайту. Регістр важливий: `pl` турнір `PL` не знайде.
 */
export const COMPETITION_SLUG_PATTERN = /^[A-Za-z0-9-]+$/;
export const COMPETITION_SLUG_MAX_LENGTH = 32;
/**
 * Slug клубу (`SLUG_PATTERN`) будує синк з назви без обрізання (P5-5): найдовший на dev-БД — 29 символів, 100 — з
 * запасом. Фільтр `GET /posts?club=` (D46), `GET /football/clubs/{slug}`.
 */
export const CLUB_SLUG_MAX_LENGTH = 100;

/** Сторінка списку новин в адмінці (`GET /posts/admin/all?limit=`): за замовчуванням і найбільша. */
export const ADMIN_POSTS_PAGE_LIMIT_DEFAULT = 20;
export const ADMIN_POSTS_PAGE_LIMIT_MAX = 100;
/** Пошук новин в адмінці — частина заголовка (`?search=`), після trim. */
export const ADMIN_POSTS_SEARCH_MAX_LENGTH = 100;

/**
 * Пошук клубів для форми новини (`GET /football/clubs/admin/search?search=`), після trim: від 2 символів
 * (`FC`, `AC` — частина назви чи код) до 100 — з запасом, найдовша назва клубу на dev-БД — 29. Видає до 20 клубів:
 * стільки форма показує одним списком, далі редактор уточнює запит.
 */
export const ADMIN_CLUBS_SEARCH_MIN_LENGTH = 2;
export const ADMIN_CLUBS_SEARCH_MAX_LENGTH = 100;
export const ADMIN_CLUBS_SEARCH_RESULTS_MAX = 20;

/**
 * Довжина рядка в байтах UTF-8 — так її рахує bcrypt. `TextEncoder`, а не `encodeURI`:
 * на одиночному surrogate (`"\ud800"` у JSON) `encodeURI` кидає виняток, а тут це 3 байти (U+FFFD).
 */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

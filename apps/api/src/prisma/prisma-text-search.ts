/** Escape-символ шаблону `LIKE` / `ILIKE` у Postgres і два символи-шаблони. */
const LIKE_SPECIAL_CHARACTERS = /[\\%_]/g;

/**
 * Умова Prisma «текст містить `search`» без урахування регістру — пошук в адмінці (M1.4.8). Prisma 7 підставляє
 * значення в `ILIKE '%' || $1 || '%'` як є (перевірено на SQL, який вона будує): `%` і `_` у запиті стали б
 * шаблоном — «100%» знайшов би «1000 fans», — тож екрануємо їх і сам `\`. Регістр кирилиці — за локаллю БД
 * (dev-БД: ICU `en-US`; «динамо» знаходить «Динамо» — e2e).
 */
export function containsIgnoringCase(search: string): {
  contains: string;
  mode: 'insensitive';
} {
  return {
    contains: search.replace(LIKE_SPECIAL_CHARACTERS, '\\$&'),
    mode: 'insensitive',
  };
}

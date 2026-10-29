/**
 * Автор змінює текст свого коментаря лише 15 хв від публікації (D27), як на YouTube: далі коментар уже прочитали й
 * відповіли на нього. Вирішує API (умова запису), сайт за тим самим правилом показує «Редагувати».
 */
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Змінити ще можна коментар, створений строго пізніше за цю мить, — умова атомарного запису в API. */
export function commentEditWindowStart(now: Date): Date {
  return new Date(now.getTime() - COMMENT_EDIT_WINDOW_MS);
}

/** Від публікації минуло менше 15 хв; рівно 15 — вікно вже закрите. */
export function isCommentEditWindowOpen(createdAt: Date, now: Date): boolean {
  return createdAt.getTime() > commentEditWindowStart(now).getTime();
}

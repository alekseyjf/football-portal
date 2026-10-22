import { slugifyTitle } from '@football-portal/validation';

export interface PostSlugUpdateInput {
  /** Пост до оновлення */
  current: {
    slug: string;
    /** `null` — у новини ще немає дати публікації */
    publishedAt: Date | null;
    /** EN-заголовок */
    defaultTitle: string | undefined;
  };
  /** Slug, який адмін передав явно */
  requestedSlug?: string;
  /** EN-заголовок із запиту — якщо запит змінює EN-переклад */
  requestedDefaultTitle?: string;
}

/**
 * Slug після оновлення новини; `undefined` — лишити як є (D24):
 * - явний slug з адмінки — завжди;
 * - поки в новини немає дати публікації — slug іде за EN-заголовком, коли той змінюється;
 * - щойно дата є (PUBLISHED, SCHEDULED) — slug зафіксовано: адреса вже могла розійтись.
 * Рішення — за станом до оновлення: «опублікувати й змінити заголовок» одним запитом дає slug нового
 * заголовка. Заголовок без змін slug не чіпає — інакше збереження чернетки скидало б явний slug.
 */
export function resolveUpdatedPostSlug(
  input: PostSlugUpdateInput,
): string | undefined {
  const nextSlug = input.requestedSlug ?? slugFromChangedDraftTitle(input);
  return nextSlug === input.current.slug ? undefined : nextSlug;
}

function slugFromChangedDraftTitle({
  current,
  requestedDefaultTitle,
}: PostSlugUpdateInput): string | undefined {
  if (current.publishedAt !== null) return undefined;
  if (
    requestedDefaultTitle === undefined ||
    requestedDefaultTitle === current.defaultTitle
  ) {
    return undefined;
  }
  return slugifyTitle(requestedDefaultTitle);
}

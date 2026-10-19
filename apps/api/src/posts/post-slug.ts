import { POST_SLUG_MAX_LENGTH } from '@football-portal/validation';

const SLUG_FALLBACK = 'post';

/** Формат slug-а — такий, який будує `slugifyTitle`: латиниця в нижньому регістрі й цифри, слова через один дефіс. */
export const POST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Латинські літери, які NFKD не розкладає на «літера + діакритика» (Ødegaard, Łukasz, Straße). */
const LATIN_LETTER_TRANSLITERATION: Record<string, string> = {
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
};

/**
 * Slug з EN-заголовка (D24): «Mbappé scores!» → `mbappe-scores`. Один на всі мови — мову задає локаль в URL.
 * Діакритику знімаємо (NFKD) і транслітеруємо `ø`/`ł`/`ß`…, решту не-ASCII (кирилиця) відкидаємо; обрізаємо по межі слова.
 */
export function slugifyTitle(title: string): string {
  const asciiWords = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[øæœßłđðþı]/g, (letter) => LATIN_LETTER_TRANSLITERATION[letter])
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let slugBase = '';
  for (const word of asciiWords) {
    const candidate = slugBase ? `${slugBase}-${word}` : word;
    if (candidate.length > POST_SLUG_MAX_LENGTH) break;
    slugBase = candidate;
  }
  // Перше слово довше за ліміт — ріжемо саме слово
  if (!slugBase && asciiWords.length > 0) {
    slugBase = asciiWords[0].slice(0, POST_SLUG_MAX_LENGTH);
  }
  return slugBase || SLUG_FALLBACK;
}

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

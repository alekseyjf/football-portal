/** Формат slug-а — такий, який будує `slugify`: латиниця в нижньому регістрі й цифри, слова через один дефіс. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
 * Slug з EN-тексту — заголовка новини (D24) чи назви тегу (D45): «Mbappé scores!» → `mbappe-scores`.
 * Діакритику знімаємо (NFKD) і транслітеруємо `ø`/`ł`/`ß`…, решту не-ASCII (кирилиця) відкидаємо;
 * обрізаємо по межі слова до `maxLength`. `null` — у тексті немає жодної латинської літери чи цифри.
 */
export function slugify(text: string, maxLength: number): string | null {
  const asciiWords = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[øæœßłđðþı]/g, (letter) => LATIN_LETTER_TRANSLITERATION[letter])
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (asciiWords.length === 0) return null;

  let slug = '';
  for (const word of asciiWords) {
    const candidate = slug ? `${slug}-${word}` : word;
    if (candidate.length > maxLength) break;
    slug = candidate;
  }
  // Перше слово довше за ліміт — ріжемо саме слово
  return slug || asciiWords[0].slice(0, maxLength);
}

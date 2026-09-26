import { randomBytes } from 'node:crypto';

const SLUG_BASE_MAX_LENGTH = 80;
const SLUG_FALLBACK = 'post';
/** 3 байти → 6 hex-символів, 16,7 млн варіантів на одну основу slug-а */
const SLUG_SUFFIX_BYTES = 3;

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
 * Slug з заголовка default-мови (P3-6): «Mbappé scores!» → `mbappe-scores`.
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
    if (candidate.length > SLUG_BASE_MAX_LENGTH) break;
    slugBase = candidate;
  }
  // Перше слово довше за ліміт — ріжемо саме слово
  if (!slugBase && asciiWords.length > 0) {
    slugBase = asciiWords[0].slice(0, SLUG_BASE_MAX_LENGTH);
  }
  return slugBase || SLUG_FALLBACK;
}

/** Колізія slug-а (`P2002`) → `mbappe-scores-3fa9c1`. */
export function withRandomSlugSuffix(slugBase: string): string {
  return `${slugBase}-${randomBytes(SLUG_SUFFIX_BYTES).toString('hex')}`;
}

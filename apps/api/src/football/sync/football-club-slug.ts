const FALLBACK_SLUG = 'club';

/**
 * Літери без розкладу NFD на «основа + діакритика»: без заміни зникли б зі slug-а
 * (`FK Bodø/Glimt` → `fk-bod-glimt`). Великі вже зведені `toLowerCase`.
 */
const LATIN_LETTER_TRANSLITERATION: Readonly<Record<string, string>> = {
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
  ħ: 'h',
};

/** Латиниця, цифри й дефіси: «Atlético de Madrid» → `atletico-de-madrid`. */
export function slugifyClubName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(
      /[øæœßłđðþıħ]/gu,
      (letter) => LATIN_LETTER_TRANSLITERATION[letter] ?? '',
    )
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || FALLBACK_SLUG;
}

/**
 * Нейтральний slug клубу (P5-5): без id провайдера в URL. Зайнятий → з кодом країни
 * (`barcelona-sc-ecu`) → з номером (`-2`, `-3`, …). Створюється один раз і не змінюється.
 * `takenSlugs` — slug-и з БД з тим самим початком + уже видані в цьому батчі.
 */
export function pickClubSlug(
  name: string,
  areaCode: string | null,
  takenSlugs: ReadonlySet<string>,
): string {
  const baseSlug = slugifyClubName(name);
  if (!takenSlugs.has(baseSlug)) return baseSlug;
  if (areaCode) {
    const withAreaCode = `${baseSlug}-${slugifyClubName(areaCode)}`;
    if (!takenSlugs.has(withAreaCode)) return withAreaCode;
  }
  for (let suffixNumber = 2; ; suffixNumber += 1) {
    const numberedSlug = `${baseSlug}-${suffixNumber}`;
    if (!takenSlugs.has(numberedSlug)) return numberedSlug;
  }
}

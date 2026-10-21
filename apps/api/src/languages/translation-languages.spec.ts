import type { ContentLanguages } from './language.service';
import { findTranslationLanguagesError } from './translation-languages';

/** Як у БД: `en` — default (`Language.isDefault`), `uk` — увімкнена */
const LANGUAGES: ContentLanguages = {
  defaultCode: 'en',
  activeCodes: new Set(['en', 'uk']),
};

const NEW_CONTENT = true;
const EXISTING_CONTENT = false;

function findError(
  languageCodes: string[],
  isNew: boolean,
  languages: ContentLanguages = LANGUAGES,
) {
  return findTranslationLanguagesError({
    translations: languageCodes.map((languageCode) => ({ languageCode })),
    isNew,
    languages,
  });
}

describe('findTranslationLanguagesError — нова новина чи тег', () => {
  it('лише EN — можна: UK опційна (D23)', () => {
    expect(findError(['en'], NEW_CONTENT)).toBeNull();
  });

  it('EN і UK — можна', () => {
    expect(findError(['en', 'uk'], NEW_CONTENT)).toBeNull();
  });

  it('без EN — DEFAULT_TRANSLATION_REQUIRED: з EN-тексту береться slug', () => {
    expect(findError(['uk'], NEW_CONTENT)).toBe('DEFAULT_TRANSLATION_REQUIRED');
  });

  it("обов'язкова — default-мова з Language, а не en у коді", () => {
    const ukrainianDefault: ContentLanguages = {
      defaultCode: 'uk',
      activeCodes: new Set(['en', 'uk']),
    };
    expect(findError(['uk'], NEW_CONTENT, ukrainianDefault)).toBeNull();
    expect(findError(['en'], NEW_CONTENT, ukrainianDefault)).toBe(
      'DEFAULT_TRANSLATION_REQUIRED',
    );
  });
});

describe('findTranslationLanguagesError — оновлення', () => {
  it('лише UK-переклад — можна: EN уже є', () => {
    expect(findError(['uk'], EXISTING_CONTENT)).toBeNull();
  });
});

describe.each([
  ['створення', NEW_CONTENT],
  ['оновлення', EXISTING_CONTENT],
])(
  'findTranslationLanguagesError — мови перекладів (%s)',
  (_scenario, isNew) => {
    it('мова двічі — DUPLICATE_TRANSLATION_LANGUAGE', () => {
      expect(findError(['en', 'uk', 'uk'], isNew)).toBe(
        'DUPLICATE_TRANSLATION_LANGUAGE',
      );
    });

    it('вимкнена або невідома мова — UNSUPPORTED_LANGUAGE', () => {
      expect(findError(['en', 'es'], isNew)).toBe('UNSUPPORTED_LANGUAGE');
    });
  },
);

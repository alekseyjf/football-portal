import type { ContentLanguages } from '../languages/language.service';
import { findPostTranslationsError } from './post-translations';

/** Як у БД: `en` — default (`Language.isDefault`), `uk` — увімкнена */
const LANGUAGES: ContentLanguages = {
  defaultCode: 'en',
  activeCodes: new Set(['en', 'uk']),
};

const NEW_POST = true;
const EXISTING_POST = false;

function findError(
  languageCodes: string[],
  isNewPost: boolean,
  languages: ContentLanguages = LANGUAGES,
) {
  return findPostTranslationsError({
    translations: languageCodes.map((languageCode) => ({ languageCode })),
    isNewPost,
    languages,
  });
}

describe('findPostTranslationsError — новий пост', () => {
  it('лише EN — можна: UK опційна (D23)', () => {
    expect(findError(['en'], NEW_POST)).toBeNull();
  });

  it('EN і UK — можна', () => {
    expect(findError(['en', 'uk'], NEW_POST)).toBeNull();
  });

  it('без EN — DEFAULT_TRANSLATION_REQUIRED: з EN-заголовка береться slug', () => {
    expect(findError(['uk'], NEW_POST)).toBe('DEFAULT_TRANSLATION_REQUIRED');
  });

  it("обов'язкова — default-мова з Language, а не en у коді", () => {
    const ukrainianDefault: ContentLanguages = {
      defaultCode: 'uk',
      activeCodes: new Set(['en', 'uk']),
    };
    expect(findError(['uk'], NEW_POST, ukrainianDefault)).toBeNull();
    expect(findError(['en'], NEW_POST, ukrainianDefault)).toBe(
      'DEFAULT_TRANSLATION_REQUIRED',
    );
  });
});

describe('findPostTranslationsError — оновлення', () => {
  it('лише UK-переклад — можна: EN у поста вже є', () => {
    expect(findError(['uk'], EXISTING_POST)).toBeNull();
  });
});

describe.each([
  ['створення', NEW_POST],
  ['оновлення', EXISTING_POST],
])(
  'findPostTranslationsError — мови перекладів (%s)',
  (_scenario, isNewPost) => {
    it('мова двічі — DUPLICATE_TRANSLATION_LANGUAGE', () => {
      expect(findError(['en', 'uk', 'uk'], isNewPost)).toBe(
        'DUPLICATE_TRANSLATION_LANGUAGE',
      );
    });

    it('вимкнена або невідома мова — UNSUPPORTED_LANGUAGE', () => {
      expect(findError(['en', 'es'], isNewPost)).toBe('UNSUPPORTED_LANGUAGE');
    });
  },
);

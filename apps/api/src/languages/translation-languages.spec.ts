import type { ContentLanguages } from './language.service';
import {
  findTranslationLanguagesError,
  type RequiredTranslationLanguages,
} from './translation-languages';

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
  {
    required = 'default',
    languages = LANGUAGES,
  }: {
    required?: RequiredTranslationLanguages;
    languages?: ContentLanguages;
  } = {},
) {
  return findTranslationLanguagesError({
    translations: languageCodes.map((languageCode) => ({ languageCode })),
    isNew,
    required,
    languages,
  });
}

describe('findTranslationLanguagesError — нова новина (обов’язкова default-мова)', () => {
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
    const languages: ContentLanguages = {
      defaultCode: 'uk',
      activeCodes: new Set(['en', 'uk']),
    };
    expect(findError(['uk'], NEW_CONTENT, { languages })).toBeNull();
    expect(findError(['en'], NEW_CONTENT, { languages })).toBe(
      'DEFAULT_TRANSLATION_REQUIRED',
    );
  });
});

describe('findTranslationLanguagesError — новий тег (обов’язкові всі мови, D51)', () => {
  it('EN і UK — можна', () => {
    expect(
      findError(['en', 'uk'], NEW_CONTENT, { required: 'all' }),
    ).toBeNull();
  });

  it('без UK — ALL_TRANSLATIONS_REQUIRED', () => {
    expect(findError(['en'], NEW_CONTENT, { required: 'all' })).toBe(
      'ALL_TRANSLATIONS_REQUIRED',
    );
  });

  it('без EN — спершу DEFAULT_TRANSLATION_REQUIRED: з англійської назви — адреса тегу', () => {
    expect(findError(['uk'], NEW_CONTENT, { required: 'all' })).toBe(
      'DEFAULT_TRANSLATION_REQUIRED',
    );
  });

  it("обов'язкові — увімкнені мови з Language: з третьою потрібна й вона", () => {
    const languages: ContentLanguages = {
      defaultCode: 'en',
      activeCodes: new Set(['en', 'uk', 'es']),
    };
    expect(
      findError(['en', 'uk'], NEW_CONTENT, { required: 'all', languages }),
    ).toBe('ALL_TRANSLATIONS_REQUIRED');
    expect(
      findError(['en', 'uk', 'es'], NEW_CONTENT, {
        required: 'all',
        languages,
      }),
    ).toBeNull();
  });
});

describe('findTranslationLanguagesError — оновлення', () => {
  it('лише UK-переклад новини — можна: EN уже є', () => {
    expect(findError(['uk'], EXISTING_CONTENT)).toBeNull();
  });

  it('лише одна назва тегу — можна: інші вже є, а прибрати їх `PUT` не може', () => {
    expect(findError(['en'], EXISTING_CONTENT, { required: 'all' })).toBeNull();
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

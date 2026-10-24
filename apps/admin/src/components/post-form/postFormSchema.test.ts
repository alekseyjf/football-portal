import type { FieldErrors } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_POST_FORM_VALUES,
  firstLanguageWithErrors,
  languageHasErrors,
  postFormSchemaFor,
  toCreatePostRequest,
  type PostFormContext,
  type PostFormValues,
} from './postFormSchema';

const ENGLISH = {
  titleEn: 'Arsenal beat Chelsea',
  excerptEn: 'A late header settled the London derby.',
  contentEn: 'Arsenal came from behind to beat Chelsea 2–1 at the Emirates.',
};
const UKRAINIAN = {
  titleUk: '«Арсенал» обіграв «Челсі»',
  excerptUk: 'Пізній гол головою вирішив лондонське дербі.',
  contentUk: '«Арсенал» відіграв гол і переміг «Челсі» 2:1 на «Емірейтс».',
};
const COVER_IMAGE_URL = 'https://images.unsplash.com/photo-1?w=1200&h=630&fit=crop&q=80';
// `datetime-local` — час у поясі редактора
const TIME_ZONE = 'Europe/Kyiv';
const FUTURE_LOCAL_TIME = '2099-01-01T10:00';
const PAST_LOCAL_TIME = '2020-01-01T10:00';
const NEW_POST: PostFormContext = { timeZone: TIME_ZONE };

function formValues(overrides: Partial<PostFormValues> = {}): PostFormValues {
  return { ...EMPTY_POST_FORM_VALUES, ...ENGLISH, ...overrides };
}

/** Поля, біля яких форма покаже помилку; `context` — новина нова чи збережена. */
function invalidFields(values: PostFormValues, context: PostFormContext = NEW_POST): string[] {
  const result = postFormSchemaFor(context).safeParse(values);
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].sort();
}

/** Текст помилки поля. */
function fieldError(values: PostFormValues, context: PostFormContext, fieldName: keyof PostFormValues) {
  const result = postFormSchemaFor(context).safeParse(values);
  return result.error?.issues.find((issue) => issue.path[0] === fieldName)?.message;
}

/** Як у формі: тіло запиту будується з уже перевірених (і обрізаних схемою) значень. */
function requestFor(values: PostFormValues) {
  return toCreatePostRequest(postFormSchemaFor(NEW_POST).parse(values), TIME_ZONE);
}

describe('postFormSchema', () => {
  it('англійська версія обов’язкова: без неї — помилка на заголовку, анонсі й тексті', () => {
    expect(invalidFields(EMPTY_POST_FORM_VALUES)).toEqual(['contentEn', 'excerptEn', 'titleEn']);
    expect(invalidFields(formValues())).toEqual([]);
  });

  it('українська — повністю або ніяк', () => {
    expect(invalidFields(formValues({ titleUk: UKRAINIAN.titleUk }))).toEqual([
      'contentUk',
      'excerptUk',
    ]);
    expect(invalidFields(formValues(UKRAINIAN))).toEqual([]);
  });

  it('Schedule — лише з датою в майбутньому; чернетці дата не потрібна', () => {
    expect(invalidFields(formValues({ publication: 'SCHEDULED' }))).toEqual(['scheduledAt']);
    expect(
      invalidFields(formValues({ publication: 'SCHEDULED', scheduledAt: PAST_LOCAL_TIME })),
    ).toEqual(['scheduledAt']);
    expect(
      invalidFields(formValues({ publication: 'SCHEDULED', scheduledAt: FUTURE_LOCAL_TIME })),
    ).toEqual([]);
  });

  it('обкладинка — лише https; публікація з нею — з описом кожною мовою новини й підписом (D44)', () => {
    expect(invalidFields(formValues({ coverImageUrl: 'http://example.com/a.jpg' }))).toEqual([
      'coverImageUrl',
    ]);
    // Чернетка може бути неповною
    expect(invalidFields(formValues({ coverImageUrl: COVER_IMAGE_URL }))).toEqual([]);
    expect(
      invalidFields(formValues({ ...UKRAINIAN, coverImageUrl: COVER_IMAGE_URL, publication: 'PUBLISHED' })),
    ).toEqual(['coverImageAltEn', 'coverImageAltUk', 'coverImageCredit']);
    expect(
      invalidFields(
        formValues({
          coverImageUrl: COVER_IMAGE_URL,
          coverImageAltEn: 'Arsenal players celebrate the winning goal',
          coverImageCredit: 'Jane Doe / Unsplash',
          publication: 'PUBLISHED',
        }),
      ),
    ).toEqual([]);
  });

  it('джерело — адреса http(s); назва без адреси — помилка біля адреси, як SOURCE_URL_REQUIRED (D26)', () => {
    expect(invalidFields(formValues({ sourceUrl: 'javascript:alert(1)' }))).toEqual(['sourceUrl']);
    expect(invalidFields(formValues({ sourceUrl: 'ftp://example.com/a' }))).toEqual(['sourceUrl']);
    expect(invalidFields(formValues({ sourceName: 'BBC Sport' }))).toEqual(['sourceUrl']);
    expect(
      invalidFields(formValues({ sourceUrl: 'http://www.bbc.co.uk/sport', sourceName: 'BBC Sport' })),
    ).toEqual([]);
  });

  it('slug: порожній чи з пробілів — «не задано»; інакше латиниця й цифри через одинарні дефіси, до 80', () => {
    for (const slug of ['', '   ', ' north-london-derby ', 'top-10-2026']) {
      expect(invalidFields(formValues({ slug }))).toEqual([]);
    }
    for (const slug of ['Arsenal Win', 'arsenal--win', 'arsenal-win-', 'арсенал', 'a'.repeat(81)]) {
      expect(invalidFields(formValues({ slug }))).toEqual(['slug']);
    }
  });

  it('помилки правил видно разом з помилками полів — редактор виправляє все за раз', () => {
    expect(
      invalidFields(formValues({ titleEn: 'Win', slug: 'Bad Slug', sourceName: 'BBC Sport', publication: 'SCHEDULED' })),
    ).toEqual(['scheduledAt', 'slug', 'sourceUrl', 'titleEn']);
  });

  it('пробіли обрізаються лише по краях усього значення: два пробіли в кінці рядка всередині тексту (перенос у Markdown) лишаються', () => {
    const markdown = 'First line of the match report  \nSecond line\n\n- Saka 12′  \n- Madueke 78′';
    const parsed = postFormSchemaFor(NEW_POST).parse(
      formValues({ ...UKRAINIAN, contentEn: `\n  ${markdown}  \n\n`, contentUk: `${markdown}\n` }),
    );
    expect(parsed.contentEn).toBe(markdown);
    expect(parsed.contentUk).toBe(markdown);
    expect(requestFor(formValues({ contentEn: ` ${markdown}\n` })).translations[0].content).toBe(markdown);
  });

  it('архівна з обкладинкою може бути без опису й підпису, як чернетка (D44)', () => {
    expect(invalidFields(formValues({ coverImageUrl: COVER_IMAGE_URL, publication: 'ARCHIVED' }))).toEqual([]);
  });
});

describe('postFormSchema: збережена новина', () => {
  const savedWithUk: PostFormContext = { timeZone: TIME_ZONE, savedValues: formValues(UKRAINIAN) };
  const savedScheduled: PostFormContext = {
    timeZone: TIME_ZONE,
    savedValues: formValues({ publication: 'SCHEDULED', scheduledAt: PAST_LOCAL_TIME }),
  };

  it('збережену українську очистити не можна (P3-5): поля обов’язкові, помилка пояснює чому', () => {
    const cleared = formValues({ titleUk: '', excerptUk: '', contentUk: '' });
    expect(invalidFields(cleared, savedWithUk)).toEqual(['contentUk', 'excerptUk', 'titleUk']);
    expect(fieldError(cleared, savedWithUk, 'titleUk')).toMatch(/already saved/);
    // Не збережену — можна й далі не заповнювати
    expect(invalidFields(cleared, { timeZone: TIME_ZONE, savedValues: formValues() })).toEqual([]);
    expect(invalidFields(formValues({ ...UKRAINIAN, titleUk: 'Нова назва новини' }), savedWithUk)).toEqual([]);
  });

  it('адреса новини на сайті не може бути порожньою: порожнє поле тихо змінило б адресу на slug заголовка (D50)', () => {
    const savedLive: PostFormContext = {
      timeZone: TIME_ZONE,
      savedValues: formValues({ publication: 'PUBLISHED', slug: 'arsenal-beat-chelsea' }),
      isLive: true,
    };
    for (const slug of ['', '   ']) {
      expect(invalidFields(formValues({ publication: 'PUBLISHED', slug }), savedLive)).toEqual(['slug']);
    }
    expect(fieldError(formValues({ publication: 'PUBLISHED', slug: '' }), savedLive, 'slug')).toBe(
      'The address of a published post can’t be empty — keep “arsenal-beat-chelsea” or type a new one',
    );
    // І тоді, коли новину саме знімають з публікації: зараз вона на сайті
    expect(invalidFields(formValues({ publication: 'ARCHIVED', slug: '' }), savedLive)).toEqual(['slug']);
    expect(invalidFields(formValues({ publication: 'PUBLISHED', slug: 'arsenal-win-derby' }), savedLive)).toEqual([]);
    // «На сайті» — за `isLive`, а не за статусом: запланована, чий час настав, лишається SCHEDULED
    const scheduledWentLive: PostFormContext = { ...savedScheduled, isLive: true };
    expect(
      invalidFields(formValues({ publication: 'SCHEDULED', scheduledAt: PAST_LOCAL_TIME, slug: '' }), scheduledWentLive),
    ).toEqual(['slug']);
    // Чернетка й запланована, що ще чекає, — порожнє поле можна: адреса з заголовка
    expect(invalidFields(formValues({ slug: '' }), { timeZone: TIME_ZONE, savedValues: formValues() })).toEqual([]);
    expect(
      invalidFields(formValues({ publication: 'SCHEDULED', scheduledAt: PAST_LOCAL_TIME, slug: '' }), savedScheduled),
    ).toEqual([]);
  });

  it('збережений розклад без змін не перевіряється: його час міг настати, поки форма відкрита', () => {
    const unchanged = formValues({ publication: 'SCHEDULED', scheduledAt: PAST_LOCAL_TIME });
    expect(invalidFields(unchanged, savedScheduled)).toEqual([]);
    // Інший час чи щойно вибраний розклад — лише в майбутньому
    expect(invalidFields(formValues({ publication: 'SCHEDULED', scheduledAt: '2020-01-02T10:00' }), savedScheduled)).toEqual([
      'scheduledAt',
    ]);
    expect(invalidFields(unchanged, { timeZone: TIME_ZONE, savedValues: formValues() })).toEqual(['scheduledAt']);
  });
});

describe('toCreatePostRequest', () => {
  it('порожні slug, обкладинка й джерело в запит не йдуть: slug візьме API з англійського заголовка (D24)', () => {
    expect(requestFor(formValues({ slug: '   ' }))).toEqual({
      translations: [{ languageCode: 'en', title: ENGLISH.titleEn, excerpt: ENGLISH.excerptEn, content: ENGLISH.contentEn }],
      status: 'DRAFT',
    });
  });

  it('вибрані теги, клуби, турніри — масивами id; нічого не вибрано — поля немає (D51)', () => {
    const request = requestFor(formValues({ tagIds: ['tag-derby', 'tag-transfers'], competitionIds: ['competition-pl'] }));
    expect(request).toMatchObject({ tagIds: ['tag-derby', 'tag-transfers'], competitionIds: ['competition-pl'] });
    expect(request).not.toHaveProperty('clubIds');
  });

  it('slug і джерело — обрізані; назва джерела — разом з адресою', () => {
    const request = requestFor(
      formValues({
        slug: ' north-london-derby ',
        sourceUrl: ' https://www.bbc.com/sport/football ',
        sourceName: ' BBC Sport ',
      }),
    );

    expect(request).toMatchObject({
      slug: 'north-london-derby',
      sourceUrl: 'https://www.bbc.com/sport/football',
      sourceName: 'BBC Sport',
    });
  });

  it('Schedule — дата з поясом; опис і підпис обкладинки — лише разом з фото (D44)', () => {
    const coverImageText = {
      coverImageAltEn: 'Arsenal players celebrate',
      coverImageAltUk: 'Гравці «Арсенала» святкують',
      coverImageCredit: 'Jane Doe / Unsplash',
    };
    const scheduled = requestFor(
      formValues({
        ...UKRAINIAN,
        ...coverImageText,
        coverImageUrl: COVER_IMAGE_URL,
        publication: 'SCHEDULED',
        scheduledAt: FUTURE_LOCAL_TIME,
      }),
    );

    // 1 січня Київ — на UTC+2
    expect(scheduled.publishedAt).toBe('2099-01-01T08:00:00.000Z');
    expect(scheduled.translations.map((translation) => translation.coverImageAlt)).toEqual([
      coverImageText.coverImageAltEn,
      coverImageText.coverImageAltUk,
    ]);
    expect(scheduled.coverImageCredit).toBe(coverImageText.coverImageCredit);

    const withoutCover = requestFor(formValues({ ...UKRAINIAN, ...coverImageText }));
    expect(withoutCover).not.toHaveProperty('coverImageCredit');
    expect(withoutCover.translations.every((translation) => !('coverImageAlt' in translation))).toBe(true);
  });
});

describe('вкладки мов із помилками', () => {
  const errorsOn = (...fieldNames: Array<keyof PostFormValues>): FieldErrors<PostFormValues> =>
    Object.fromEntries(fieldNames.map((fieldName) => [fieldName, { type: 'custom', message: 'Invalid' }]));

  it('фокус — на першій вкладці з помилкою: EN раніше за UK; помилки поза вкладками — без перемикання', () => {
    expect(firstLanguageWithErrors(errorsOn('contentUk', 'titleEn'))).toBe('en');
    expect(firstLanguageWithErrors(errorsOn('slug', 'excerptUk'))).toBe('uk');
    expect(firstLanguageWithErrors(errorsOn('slug', 'coverImageAltUk', 'sourceUrl'))).toBeNull();
  });

  it('позначка на вкладці — лише за полями самої вкладки', () => {
    const errors = errorsOn('contentUk', 'coverImageAltEn');
    expect(languageHasErrors(errors, 'uk')).toBe(true);
    expect(languageHasErrors(errors, 'en')).toBe(false);
  });
});

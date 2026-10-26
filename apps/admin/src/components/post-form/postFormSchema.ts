import type { FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import {
  mediaUrlSchema,
  postContentSchema,
  postCoverImageAltSchema,
  postCoverImageCreditSchema,
  postExcerptSchema,
  postSlugSchema,
  postSourceNameSchema,
  postTitleSchema,
  sourceUrlSchema,
  youtubeVideoUrlSchema,
} from '@football-portal/validation/forms';
import type { CreatePostRequest, PostTranslationRequest } from '@/lib/api/types';
import { fromDateTimeLocalValue } from '@/lib/editorDateTime';

/** Мови новини у формі, у порядку вкладок: EN обов'язкова (з її заголовка — адреса, D24), UK — бажана (D23). */
export const POST_FORM_LANGUAGES = ['en', 'uk'] as const;
export type PostFormLanguage = (typeof POST_FORM_LANGUAGES)[number];

/** Поля перекладу на вкладці кожної мови. */
export const TRANSLATION_FIELD_NAMES = {
  en: { title: 'titleEn', excerpt: 'excerptEn', content: 'contentEn' },
  uk: { title: 'titleUk', excerpt: 'excerptUk', content: 'contentUk' },
} as const;

/** Українські поля: або всі порожні, або всі валідні за тими ж межами, що й англійські. */
const UK_FIELD_SCHEMAS = {
  titleUk: postTitleSchema,
  excerptUk: postExcerptSchema,
  contentUk: postContentSchema,
} as const;
export const UK_FIELD_NAMES = Object.keys(UK_FIELD_SCHEMAS) as Array<
  keyof typeof UK_FIELD_SCHEMAS
>;

/** Хоч одне українське поле заповнене — переклад піде в запит (а форма вимагатиме всі поля). */
export function hasUkText(ukFieldValues: readonly string[]): boolean {
  return ukFieldValues.some((value) => value.trim());
}

/** Опис і підпис обкладинки (D44) — поля видно й надсилаємо, лише поки задано адресу фото. */
const COVER_IMAGE_TEXT_SCHEMAS = {
  coverImageAltEn: postCoverImageAltSchema,
  coverImageAltUk: postCoverImageAltSchema,
  coverImageCredit: postCoverImageCreditSchema,
} as const;
export const COVER_IMAGE_TEXT_FIELD_NAMES = Object.keys(COVER_IMAGE_TEXT_SCHEMAS) as Array<
  keyof typeof COVER_IMAGE_TEXT_SCHEMAS
>;

/** Необов'язкове поле: порожнє чи з самих пробілів — «не задано», інакше — за схемою (її помилку й покаже форма). */
function optionalField(schema: z.ZodType<string, string>) {
  return z.string().trim().pipe(schema.or(z.literal('')));
}

/**
 * Поля форми. Після перевірки кожне текстове — без пробілів по краях, як його збереже API: тіло запиту й
 * порівняння зі збереженою новиною беруть значення як є.
 */
const formFieldsSchema = z.object({
  // Межі — зі спільного пакета: ті самі числа, що в CreatePostDto API
  titleEn: postTitleSchema,
  excerptEn: postExcerptSchema,
  contentEn: postContentSchema,
  // Межі української — в addUkTranslationIssues: її можна не заповнювати зовсім
  titleUk: z.string().trim(),
  excerptUk: z.string().trim(),
  contentUk: z.string().trim(),
  // Порожній — адреса з англійського заголовка (D24), поле не надсилаємо
  slug: optionalField(postSlugSchema),
  // Лише https — як `@IsMediaUrl()` у DTO API
  coverImageUrl: optionalField(mediaUrlSchema),
  // Межі опису й підпису — в addCoverImageIssues, лише з адресою фото: без неї поля сховані,
  // і схована помилка мовчки блокувала б відправку
  coverImageAltEn: z.string().trim(),
  coverImageAltUk: z.string().trim(),
  coverImageCredit: z.string().trim(),
  // Лише YouTube — та сама перевірка, що в `@IsYouTubeVideoUrl()` API (D54)
  videoUrl: optionalField(youtubeVideoUrlSchema),
  // http(s) — як `@IsSourceUrl()`; назва без адреси — в addSourceIssues
  sourceUrl: optionalField(sourceUrlSchema),
  sourceName: postSourceNameSchema,
  // Теги, клуби, турніри — id набором (`postRelations.ts`); межу кожного виду тримає вибір (D51)
  tagIds: z.array(z.string()),
  clubIds: z.array(z.string()),
  competitionIds: z.array(z.string()),
  // Які з них доступні, залежить від стану новини — `publicationOptionsFor`; ARCHIVED — лише в редагуванні
  publication: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']),
  /** Значення `<input type="datetime-local">` — час у поясі редактора */
  scheduledAt: z.string().trim(),
});

export type PostFormValues = z.infer<typeof formFieldsSchema>;
export type PostPublication = PostFormValues['publication'];
type FormRefinementCtx = z.RefinementCtx<PostFormValues>;

/** Новина на сайті або вийде сама — для неї діють правила публікації (D23, D44), як `isLivePostStatus` в API. */
export function isLivePublication(publication: PostPublication): boolean {
  return publication === 'PUBLISHED' || publication === 'SCHEDULED';
}

/** Те, від чого залежать правила форми, крім її полів. */
export interface PostFormContext {
  /** Пояс редактора: у ньому значення поля дати розкладу */
  timeZone: string;
  /** Значення збереженої новини (`toPostFormValues`); без них — нова новина */
  savedValues?: PostFormValues;
  /**
   * Збережена новина зараз на сайті — `isLive` з API, а не статус: у запланованої, чий час настав, статус лишається
   * SCHEDULED (D47)
   */
  isLive?: boolean;
}

/** Нова новина: усе порожнє, чернетка. */
export const EMPTY_POST_FORM_VALUES: PostFormValues = {
  titleEn: '',
  excerptEn: '',
  contentEn: '',
  titleUk: '',
  excerptUk: '',
  contentUk: '',
  slug: '',
  coverImageUrl: '',
  coverImageAltEn: '',
  coverImageAltUk: '',
  coverImageCredit: '',
  videoUrl: '',
  sourceUrl: '',
  sourceName: '',
  tagIds: [],
  clubIds: [],
  competitionIds: [],
  publication: 'DRAFT',
  scheduledAt: '',
};

/**
 * Поля, чиї помилки залежать від цього (правила нижче), — для `register(…, { deps })`: після невдалої
 * відправки React Hook Form перевіряє лише змінене поле, і без `deps` помилка «required to publish»
 * лишалась би після зміни статусу, адреси фото, української версії чи назви джерела.
 */
export const DEPENDENT_FIELD_NAMES = {
  publication: ['scheduledAt', ...COVER_IMAGE_TEXT_FIELD_NAMES],
  coverImageUrl: COVER_IMAGE_TEXT_FIELD_NAMES,
  ukTranslation: [...UK_FIELD_NAMES, 'coverImageAltUk'],
  sourceName: ['sourceUrl'],
} satisfies Record<string, Array<keyof PostFormValues>>;

/** `deps` полів перекладу: українська — або всі поля, або жодного, тож зміна одного перевіряє решту. */
export function translationFieldDeps(language: PostFormLanguage): Array<keyof PostFormValues> {
  return language === 'uk' ? DEPENDENT_FIELD_NAMES.ukTranslation : [];
}

/** У новини є українська версія — у формі чи збережена (`savedValues`). */
export function hasUkTranslation(values: PostFormValues): boolean {
  return hasUkText(UK_FIELD_NAMES.map((fieldName) => values[fieldName]));
}

export function hasCoverImage(coverImageUrl: string): boolean {
  return Boolean(coverImageUrl.trim());
}

/**
 * Українська — повністю або ніяк; збережену прибрати не можна (P3-5: `PUT` переклад не видаляє), тож її поля
 * обов'язкові, як англійські. Інакше очищені поля мовчки лишили б на сайті стару версію.
 */
function addUkTranslationIssues(values: PostFormValues, ctx: FormRefinementCtx, isUkSaved: boolean) {
  if (!isUkSaved && !hasUkTranslation(values)) return;
  for (const fieldName of UK_FIELD_NAMES) {
    const fieldResult = UK_FIELD_SCHEMAS[fieldName].safeParse(values[fieldName]);
    if (fieldResult.success) continue;
    const emptyFieldMessage = isUkSaved
      ? 'The Ukrainian version is already saved and can’t be removed — fix the text instead'
      : 'Fill all Ukrainian fields or leave all empty';
    ctx.addIssue({
      code: 'custom',
      path: [fieldName],
      message: values[fieldName].trim() ? fieldResult.error.issues[0].message : emptyFieldMessage,
    });
  }
}

function addScheduleIssues(values: PostFormValues, ctx: FormRefinementCtx, context: PostFormContext) {
  if (values.publication !== 'SCHEDULED') return;
  const scheduledAt = fromDateTimeLocalValue(values.scheduledAt, context.timeZone);
  if (!scheduledAt) {
    ctx.addIssue({ code: 'custom', path: ['scheduledAt'], message: 'Choose when the post goes live' });
    return;
  }
  // Збережений розклад без змін у запит не йде, а його час міг настати, поки форма відкрита (новина вже вийшла)
  const { savedValues } = context;
  const isSavedSchedule =
    savedValues?.publication === 'SCHEDULED' && savedValues.scheduledAt === values.scheduledAt;
  if (!isSavedSchedule && new Date(scheduledAt).getTime() <= Date.now()) {
    ctx.addIssue({ code: 'custom', path: ['scheduledAt'], message: 'Scheduled time must be in the future' });
  }
}

/**
 * Як правило API (D44): опублікувати з обкладинкою — лише з описом для незрячих кожною мовою новини
 * й підписом автора фото; чернетка й архівна можуть бути неповними. Без цієї перевірки редактор дізнався б
 * про пропуск з 400 після відправлення.
 */
function addCoverImageIssues(values: PostFormValues, ctx: FormRefinementCtx) {
  if (!hasCoverImage(values.coverImageUrl)) return;
  const addFieldIssue = (fieldName: keyof PostFormValues, message: string) =>
    ctx.addIssue({ code: 'custom', path: [fieldName], message });
  for (const fieldName of COVER_IMAGE_TEXT_FIELD_NAMES) {
    const fieldResult = COVER_IMAGE_TEXT_SCHEMAS[fieldName].safeParse(values[fieldName]);
    if (!fieldResult.success) addFieldIssue(fieldName, fieldResult.error.issues[0].message);
  }

  const isUkTranslated = hasUkTranslation(values);
  if (!isUkTranslated && values.coverImageAltUk.trim()) {
    addFieldIssue('coverImageAltUk', 'Fill the Ukrainian version of the post or leave this empty');
  }
  if (!isLivePublication(values.publication)) return;
  if (!values.coverImageAltEn.trim()) {
    addFieldIssue('coverImageAltEn', 'Describe the photo — required to publish with a cover');
  }
  if (isUkTranslated && !values.coverImageAltUk.trim()) {
    addFieldIssue('coverImageAltUk', 'Describe the photo in Ukrainian — the post has a Ukrainian version');
  }
  if (!values.coverImageCredit.trim()) {
    addFieldIssue('coverImageCredit', 'Credit the photographer or agency — required to publish with a cover');
  }
}

/**
 * Адреса новини на сайті (D24, D50): порожнє поле — «адреса з англійського заголовка», тож у живої новини воно
 * тихо замінило б адресу, яка вже розійшлась. Змінити її можна лише явно — вписавши нову.
 */
function addLiveSlugIssues(values: PostFormValues, ctx: FormRefinementCtx, savedValues: PostFormValues) {
  if (values.slug.trim()) return;
  ctx.addIssue({
    code: 'custom',
    path: ['slug'],
    message: `The address of a published post can’t be empty — keep “${savedValues.slug}” or type a new one`,
  });
}

/** Як правило API (D26, `SOURCE_URL_REQUIRED`): назва джерела — лише разом з адресою статті. */
function addSourceIssues(values: PostFormValues, ctx: FormRefinementCtx) {
  if (!values.sourceName.trim() || values.sourceUrl.trim()) return;
  ctx.addIssue({
    code: 'custom',
    path: ['sourceUrl'],
    message: 'Add the article URL — the source name is shown only with it',
  });
}

/** Схема форми: поля й правила між ними; частина правил залежить від збереженої новини (`context`). */
export function postFormSchemaFor(context: PostFormContext) {
  const { savedValues } = context;
  const isUkSaved = savedValues ? hasUkTranslation(savedValues) : false;
  const liveSavedValues = context.isLive && savedValues ? savedValues : null;
  return formFieldsSchema.superRefine((values, ctx) => {
    addUkTranslationIssues(values, ctx, isUkSaved);
    addScheduleIssues(values, ctx, context);
    addCoverImageIssues(values, ctx);
    addSourceIssues(values, ctx);
    if (liveSavedValues) addLiveSlugIssues(values, ctx, liveSavedValues);
  });
}

/** На вкладці мови є поле з помилкою — позначка на назві вкладки. */
export function languageHasErrors(
  errors: FieldErrors<PostFormValues>,
  language: PostFormLanguage,
): boolean {
  return Object.values(TRANSLATION_FIELD_NAMES[language]).some((fieldName) => Boolean(errors[fieldName]));
}

/**
 * Вкладка мови, на поле якої React Hook Form поставить фокус після невдалої відправки: поля вкладок — першими
 * у формі, EN — раніше за UK. `null` — помилки лише поза вкладками.
 */
export function firstLanguageWithErrors(
  errors: FieldErrors<PostFormValues>,
): PostFormLanguage | null {
  return POST_FORM_LANGUAGES.find((language) => languageHasErrors(errors, language)) ?? null;
}

/**
 * Значення форми після перевірки (без пробілів по краях) → тіло `POST /posts`. `timeZone` — пояс редактора,
 * у ньому поле дати розкладу.
 */
export function toCreatePostRequest(values: PostFormValues, timeZone: string): CreatePostRequest {
  // Без обкладинки опис і підпис не надсилаємо: API їх однаково не збереже (D44)
  const coverImageUrl = values.coverImageUrl || null;
  const withCoverImageAlt = (alt: string) => (coverImageUrl && alt ? { coverImageAlt: alt } : {});
  const publishedAt =
    values.publication === 'SCHEDULED' ? fromDateTimeLocalValue(values.scheduledAt, timeZone) : null;

  const translations: PostTranslationRequest[] = [
    {
      languageCode: 'en',
      title: values.titleEn,
      excerpt: values.excerptEn,
      content: values.contentEn,
      ...withCoverImageAlt(values.coverImageAltEn),
    },
  ];
  if (hasUkTranslation(values)) {
    translations.push({
      languageCode: 'uk',
      title: values.titleUk,
      excerpt: values.excerptUk,
      content: values.contentUk,
      ...withCoverImageAlt(values.coverImageAltUk),
    });
  }

  return {
    translations,
    status: values.publication,
    // Порожній slug не надсилаємо: API візьме його з англійського заголовка (D24); явний — фіксується з публікацією
    ...(values.slug ? { slug: values.slug } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(coverImageUrl ? { coverImageUrl } : {}),
    ...(coverImageUrl && values.coverImageCredit ? { coverImageCredit: values.coverImageCredit } : {}),
    // API збереже канонічне посилання (D54)
    ...(values.videoUrl ? { videoUrl: values.videoUrl } : {}),
    // Назва джерела — лише з адресою (D26): форма не пропустить іншого, а API відповів би 400
    ...(values.sourceUrl ? { sourceUrl: values.sourceUrl } : {}),
    ...(values.sourceUrl && values.sourceName ? { sourceName: values.sourceName } : {}),
    // Вибрані теги, клуби, турніри (D51); нічого не вибрано — поля немає
    ...(values.tagIds.length > 0 ? { tagIds: values.tagIds } : {}),
    ...(values.clubIds.length > 0 ? { clubIds: values.clubIds } : {}),
    ...(values.competitionIds.length > 0 ? { competitionIds: values.competitionIds } : {}),
  };
}

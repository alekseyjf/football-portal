import { z } from 'zod';
import {
  mediaUrlSchema,
  postContentSchema,
  postCoverImageAltSchema,
  postCoverImageCreditSchema,
  postExcerptSchema,
  postTitleSchema,
} from '@football-portal/validation/forms';
import type { CreatePostRequest, PostTranslationRequest } from '@/lib/api/types';

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
const COVER_IMAGE_TEXT_FIELD_NAMES = Object.keys(COVER_IMAGE_TEXT_SCHEMAS) as Array<
  keyof typeof COVER_IMAGE_TEXT_SCHEMAS
>;

const formFieldsSchema = z.object({
  // Межі — зі спільного пакета: ті самі числа, що в CreatePostDto API
  titleEn: postTitleSchema,
  excerptEn: postExcerptSchema,
  contentEn: postContentSchema,
  titleUk: z.string(),
  excerptUk: z.string(),
  contentUk: z.string(),
  // Лише https — як `@IsMediaUrl()` у DTO API
  coverImageUrl: mediaUrlSchema.optional().or(z.literal('')),
  // Межі опису й підпису — в addCoverImageIssues, лише з адресою фото: без неї поля сховані,
  // і схована помилка мовчки блокувала б відправку
  coverImageAltEn: z.string(),
  coverImageAltUk: z.string(),
  coverImageCredit: z.string(),
  publication: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']),
  /** Значення `<input type="datetime-local">` — локальний час редактора */
  scheduledAt: z.string(),
});

export type CreatePostFormValues = z.infer<typeof formFieldsSchema>;
type FormRefinementCtx = z.RefinementCtx<CreatePostFormValues>;

function hasUkTranslation(values: CreatePostFormValues): boolean {
  return hasUkText(UK_FIELD_NAMES.map((fieldName) => values[fieldName]));
}

export function hasCoverImage(coverImageUrl: string | undefined): boolean {
  return Boolean(coverImageUrl?.trim());
}

function addUkTranslationIssues(values: CreatePostFormValues, ctx: FormRefinementCtx) {
  if (!hasUkTranslation(values)) return;
  for (const fieldName of UK_FIELD_NAMES) {
    const fieldResult = UK_FIELD_SCHEMAS[fieldName].safeParse(values[fieldName]);
    if (!fieldResult.success) {
      ctx.addIssue({
        code: 'custom',
        path: [fieldName],
        message: values[fieldName].trim()
          ? fieldResult.error.issues[0].message
          : 'Fill all Ukrainian fields or leave all empty',
      });
    }
  }
}

function addScheduleIssues(values: CreatePostFormValues, ctx: FormRefinementCtx) {
  if (values.publication !== 'SCHEDULED') return;
  const scheduledTime = new Date(values.scheduledAt).getTime();
  if (!values.scheduledAt || Number.isNaN(scheduledTime)) {
    ctx.addIssue({ code: 'custom', path: ['scheduledAt'], message: 'Choose when the post goes live' });
  } else if (scheduledTime <= Date.now()) {
    ctx.addIssue({ code: 'custom', path: ['scheduledAt'], message: 'Scheduled time must be in the future' });
  }
}

/**
 * Як правило API (D44): опублікувати з обкладинкою — лише з описом для незрячих кожною мовою новини
 * й підписом автора фото; чернетка може бути неповною. Без цієї перевірки редактор дізнався б про
 * пропуск з 400 після відправлення.
 */
function addCoverImageIssues(values: CreatePostFormValues, ctx: FormRefinementCtx) {
  if (!hasCoverImage(values.coverImageUrl)) return;
  const addFieldIssue = (fieldName: keyof CreatePostFormValues, message: string) =>
    ctx.addIssue({ code: 'custom', path: [fieldName], message });
  for (const fieldName of COVER_IMAGE_TEXT_FIELD_NAMES) {
    const fieldResult = COVER_IMAGE_TEXT_SCHEMAS[fieldName].safeParse(values[fieldName]);
    if (!fieldResult.success) addFieldIssue(fieldName, fieldResult.error.issues[0].message);
  }

  const isUkTranslated = hasUkTranslation(values);
  if (!isUkTranslated && values.coverImageAltUk.trim()) {
    addFieldIssue('coverImageAltUk', 'Fill the Ukrainian version of the post or leave this empty');
  }
  if (values.publication === 'DRAFT') return;
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

export const createPostFormSchema = formFieldsSchema.superRefine((values, ctx) => {
  addUkTranslationIssues(values, ctx);
  addScheduleIssues(values, ctx);
  addCoverImageIssues(values, ctx);
});

/** `datetime-local` (без зони) → ISO з `Z`: браузер читає його в локальній зоні редактора. */
function toIsoWithZone(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

/** Значення форми → тіло `POST /posts`; англійські поля вже після trim у zod-схемах, решту обрізаємо тут. */
export function toCreatePostRequest(values: CreatePostFormValues): CreatePostRequest {
  // Без обкладинки опис і підпис не надсилаємо: API їх однаково не збереже (D44)
  const coverImageUrl = values.coverImageUrl?.trim() || null;
  const coverImageCredit = values.coverImageCredit.trim();
  const withCoverImageAlt = (alt: string) =>
    coverImageUrl && alt.trim() ? { coverImageAlt: alt.trim() } : {};

  const translations: PostTranslationRequest[] = [
    {
      languageCode: 'en',
      title: values.titleEn,
      excerpt: values.excerptEn,
      content: values.contentEn,
      ...withCoverImageAlt(values.coverImageAltEn),
    },
  ];
  if (values.titleUk.trim()) {
    translations.push({
      languageCode: 'uk',
      title: values.titleUk.trim(),
      excerpt: values.excerptUk.trim(),
      content: values.contentUk.trim(),
      ...withCoverImageAlt(values.coverImageAltUk),
    });
  }

  return {
    translations,
    status: values.publication,
    ...(values.publication === 'SCHEDULED'
      ? { publishedAt: toIsoWithZone(values.scheduledAt) }
      : {}),
    ...(coverImageUrl ? { coverImageUrl } : {}),
    ...(coverImageUrl && coverImageCredit ? { coverImageCredit } : {}),
  };
}

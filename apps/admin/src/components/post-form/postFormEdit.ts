import { slugifyTitle } from '@football-portal/validation';
import type { AdminPostDetail, PostTranslationRequest, UpdatePostRequest } from '@/lib/api/types';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/editorDateTime';
import {
  POST_FORM_LANGUAGES,
  TRANSLATION_FIELD_NAMES,
  type PostFormLanguage,
  type PostFormValues,
  type PostPublication,
} from './postFormSchema';
import { isSameRelationSet, toRelationIds } from './postRelations';

/** Опис обкладинки кожною мовою — поле форми (D44). */
const COVER_IMAGE_ALT_FIELD_NAMES = { en: 'coverImageAltEn', uk: 'coverImageAltUk' } as const;

/** Статус, яким новину бачить редактор: запланована, чий час настав, уже на сайті — «Published» (D47). */
export function editorPublication(post: Pick<AdminPostDetail, 'status' | 'isLive'>): PostPublication {
  return post.isLive ? 'PUBLISHED' : post.status;
}

/**
 * Поле slug (D24): поки в новини немає дати, а slug — із заголовка, поле порожнє — адреса й далі йде за
 * заголовком; інакше в полі поточний slug: зафіксований датою чи вписаний явно.
 */
function slugFieldValue(post: AdminPostDetail, titleEn: string): string {
  return post.publishedAt === null && post.slug === slugifyTitle(titleEn) ? '' : post.slug;
}

/**
 * Текст збереженої новини — без пробілів і переносів по краях, як його надішле форма (схема обрізає краї): текст,
 * збережений до того, як API почав обрізати, не стає «зміною» в `PUT`. Усередині не чіпаємо — у Markdown два
 * пробіли в кінці рядка означають перенос.
 */
function savedText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Збережена новина → поля форми. Переклади мовами поза формою (вимкненими) не потрапляють у неї й у запит. */
export function toPostFormValues(post: AdminPostDetail, timeZone: string): PostFormValues {
  const translationOf = (language: PostFormLanguage) =>
    post.translations.find((translation) => translation.languageCode === language);
  const english = translationOf('en');
  const ukrainian = translationOf('uk');
  const publication = editorPublication(post);

  return {
    titleEn: savedText(english?.title),
    excerptEn: savedText(english?.excerpt),
    contentEn: savedText(english?.content),
    titleUk: savedText(ukrainian?.title),
    excerptUk: savedText(ukrainian?.excerpt),
    contentUk: savedText(ukrainian?.content),
    slug: slugFieldValue(post, savedText(english?.title)),
    coverImageUrl: savedText(post.coverImageUrl),
    coverImageAltEn: savedText(english?.coverImageAlt),
    coverImageAltUk: savedText(ukrainian?.coverImageAlt),
    coverImageCredit: savedText(post.coverImageCredit),
    sourceUrl: savedText(post.sourceUrl),
    sourceName: savedText(post.sourceName),
    tagIds: toRelationIds(post.tags),
    clubIds: toRelationIds(post.clubs),
    competitionIds: toRelationIds(post.competitions),
    publication,
    // Дата в полі — лише в запланованої, що ще чекає: решті вона не потрібна
    scheduledAt:
      publication === 'SCHEDULED' && post.publishedAt
        ? toDateTimeLocalValue(new Date(post.publishedAt), timeZone)
        : '',
  };
}

/**
 * Переклад мовою — лише якщо змінилось його поле: заголовок, анонс, текст чи опис фото. API приймає переклад
 * повністю, опис — окремо: та сама обкладинка — лише змінений (очищений — `null`); нове фото — опис знову, бо
 * старий API не перенесе (D44); без фото — не надсилаємо, API прибере його сам.
 */
function translationChange(
  language: PostFormLanguage,
  before: PostFormValues,
  after: PostFormValues,
): PostTranslationRequest | null {
  const fieldNames = TRANSLATION_FIELD_NAMES[language];
  // Мову не заповнено (українська — бажана): перекладу немає. Збережену очистити не дає схема форми
  if (!after[fieldNames.title]) return null;

  const altFieldName = COVER_IMAGE_ALT_FIELD_NAMES[language];
  const alt = after[altFieldName];
  const isNewCoverImage = before.coverImageUrl !== after.coverImageUrl;
  let coverImageAlt: string | null | undefined;
  if (after.coverImageUrl && isNewCoverImage) coverImageAlt = alt || undefined;
  else if (after.coverImageUrl && before[altFieldName] !== alt) coverImageAlt = alt || null;

  const isTextChanged = Object.values(fieldNames).some((fieldName) => before[fieldName] !== after[fieldName]);
  if (!isTextChanged && coverImageAlt === undefined) return null;
  return {
    languageCode: language,
    title: after[fieldNames.title],
    excerpt: after[fieldNames.excerpt],
    content: after[fieldNames.content],
    ...(coverImageAlt !== undefined ? { coverImageAlt } : {}),
  };
}

function translationsChange(before: PostFormValues, after: PostFormValues): UpdatePostRequest {
  const translations = POST_FORM_LANGUAGES.map((language) => translationChange(language, before, after)).filter(
    (translation) => translation !== null,
  );
  return translations.length > 0 ? { translations } : {};
}

/**
 * Slug (D24): порожнє поле — адреса з англійського заголовка, вписане — явний slug. Надсилаємо, коли адреса
 * зміниться; явний — і тоді, коли змінився заголовок: інакше API дав би чернетці slug нового заголовка.
 */
function slugChange(before: PostFormValues, after: PostFormValues): UpdatePostRequest {
  const savedSlug = before.slug || slugifyTitle(before.titleEn);
  const nextSlug = after.slug || slugifyTitle(after.titleEn);
  const keepsTypedSlug = Boolean(after.slug) && before.titleEn !== after.titleEn;
  return nextSlug !== savedSlug || keepsTypedSlug ? { slug: nextSlug } : {};
}

/**
 * Адреса й текст, що описує саме її: підпис фото (D44), назва джерела (D26). Інша адреса — текст разом з нею
 * (старий API не перенесе), прибрана — лише `null`: текст API прибере сам; та сама — лише змінений текст.
 */
function linkedTextChange(
  url: { before: string; after: string },
  text: { before: string; after: string },
): { url?: string | null; text?: string | null } {
  if (url.before !== url.after) {
    if (!url.after) return { url: null };
    return text.after ? { url: url.after, text: text.after } : { url: url.after };
  }
  if (!url.after || text.before === text.after) return {};
  return { text: text.after || null };
}

function coverImageChange(before: PostFormValues, after: PostFormValues): UpdatePostRequest {
  const change = linkedTextChange(
    { before: before.coverImageUrl, after: after.coverImageUrl },
    { before: before.coverImageCredit, after: after.coverImageCredit },
  );
  return {
    ...(change.url !== undefined ? { coverImageUrl: change.url } : {}),
    ...(change.text !== undefined ? { coverImageCredit: change.text } : {}),
  };
}

function sourceChange(before: PostFormValues, after: PostFormValues): UpdatePostRequest {
  const change = linkedTextChange(
    { before: before.sourceUrl, after: after.sourceUrl },
    { before: before.sourceName, after: after.sourceName },
  );
  return {
    ...(change.url !== undefined ? { sourceUrl: change.url } : {}),
    ...(change.text !== undefined ? { sourceName: change.text } : {}),
  };
}

/**
 * Теги, клуби, турніри (D51): переданий масив замінює зв'язки, тож надсилаємо лише вид, чий набір змінився (порядок
 * не важить — БД його не зберігає). Незмінений набір не йде: інакше стер би зв'язки, задані тим часом через Swagger чи
 * іншим адміном (D50).
 */
function relationsChange(before: PostFormValues, after: PostFormValues): UpdatePostRequest {
  const isChanged = (fieldName: 'tagIds' | 'clubIds' | 'competitionIds') =>
    !isSameRelationSet(before[fieldName], after[fieldName]);
  return {
    ...(isChanged('tagIds') ? { tagIds: after.tagIds } : {}),
    ...(isChanged('clubIds') ? { clubIds: after.clubIds } : {}),
    ...(isChanged('competitionIds') ? { competitionIds: after.competitionIds } : {}),
  };
}

/**
 * Публікація — пара «статус + дата»: змінилось хоч одне — надсилаємо статус, а для розкладу й дату. Без дати
 * API сам вирішує: Published — дата наявна минула (архівна повертається зі своєю) або зараз; Draft — без дати.
 */
function publicationChange(before: PostFormValues, after: PostFormValues, timeZone: string): UpdatePostRequest {
  const isScheduleChanged = after.publication === 'SCHEDULED' && before.scheduledAt !== after.scheduledAt;
  if (before.publication === after.publication && !isScheduleChanged) return {};
  if (after.publication !== 'SCHEDULED') return { status: after.publication };
  const publishedAt = fromDateTimeLocalValue(after.scheduledAt, timeZone);
  return publishedAt ? { status: 'SCHEDULED', publishedAt } : { status: 'SCHEDULED' };
}

/**
 * Тіло `PUT /posts/{id}` — лише змінене (👤 M1.5.2, D50): `saved` — поля збереженої новини (`toPostFormValues`),
 * `current` — форми після перевірки (обидва без пробілів по краях); порівнюємо значення. Не передане API не
 * чіпає, `null` — прибирає, тож правка не перезапише того, чого редактор не міняв. Зв'язки — набором
 * (`relationsChange`); відео форма не редагує — його немає в запиті зовсім.
 */
export function toUpdatePostRequest(
  saved: PostFormValues,
  current: PostFormValues,
  timeZone: string,
): UpdatePostRequest {
  return {
    ...translationsChange(saved, current),
    ...slugChange(saved, current),
    ...coverImageChange(saved, current),
    ...sourceChange(saved, current),
    ...relationsChange(saved, current),
    ...publicationChange(saved, current, timeZone),
  };
}

/** У запиті є що змінювати. */
export function hasPostChanges(request: UpdatePostRequest): boolean {
  return Object.keys(request).length > 0;
}

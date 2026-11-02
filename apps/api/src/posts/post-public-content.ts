import type { UpdatePostData } from './admin-post.repository';

/** Переклад, як його бачить читач. */
export interface PublicTranslationState {
  languageCode: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageAlt: string | null;
}

/** Те, що збережена новина показує на сайті (крім статусу й дати — їх ведуть події публікації). */
export interface PostPublicState {
  slug: string;
  coverImageUrl: string | null;
  coverImageCredit: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  translations: readonly PublicTranslationState[];
  tags: readonly { tagId: string }[];
  clubs: readonly { clubId: string }[];
  competitions: readonly { competitionId: string }[];
}

/**
 * Чи запис змінює те, що бачить читач (D57, подія `post.updated`): адресу, медіа, джерело, текст і переклади (новий
 * переклад — теж), теги, клуби, турніри. Порівнюємо значення, а не наявність поля в запиті: повторне збереження того
 * самого — не зміна. Закріплення головною — окремий запис (D56), сюди не входить.
 */
export function changesPublicContent(
  current: PostPublicState,
  update: UpdatePostData,
): boolean {
  return (
    isChanged(update.slug, current.slug) ||
    isChanged(update.coverImageUrl, current.coverImageUrl) ||
    isChanged(update.coverImageCredit, current.coverImageCredit) ||
    isChanged(update.videoUrl, current.videoUrl) ||
    isChanged(update.sourceUrl, current.sourceUrl) ||
    isChanged(update.sourceName, current.sourceName) ||
    changesTranslations(current.translations, update.translations) ||
    changesIdSet(
      current.tags.map((link) => link.tagId),
      update.tagIds,
    ) ||
    changesIdSet(
      current.clubs.map((link) => link.clubId),
      update.clubIds,
    ) ||
    changesIdSet(
      current.competitions.map((link) => link.competitionId),
      update.competitionIds,
    )
  );
}

/** `undefined` — поле не змінюється. */
function isChanged<Value>(requested: Value | undefined, current: Value) {
  return requested !== undefined && requested !== current;
}

function changesTranslations(
  current: readonly PublicTranslationState[],
  requested: UpdatePostData['translations'],
): boolean {
  return (requested ?? []).some((translation) => {
    const saved = current.find(
      (candidate) => candidate.languageCode === translation.languageCode,
    );
    if (!saved) return true;
    return (
      isTextChanged(saved, translation) ||
      isChanged(translation.coverImageAlt, saved.coverImageAlt)
    );
  });
}

/** Текст перекладу: заголовок, анонс, текст новини. */
type TranslationText = Pick<
  PublicTranslationState,
  'title' | 'excerpt' | 'content'
>;

function isTextChanged(
  saved: TranslationText,
  requested: TranslationText,
): boolean {
  return (
    requested.title !== saved.title ||
    requested.excerpt !== saved.excerpt ||
    requested.content !== saved.content
  );
}

/**
 * Дата правки перекладу (`PostTranslation.updatedAt`, OQ-26) — коли змінився його текст: заголовок, анонс чи текст
 * новини. Сайт віддає її (пізнішу з датою публікації) як `dateModified` і `article:modified_time`, а sitemap — як
 * `lastmod` адреси цією мовою. Google радить зсувати ці дати лише за суттєвої зміни, тож опис фото (D44) і той самий
 * текст, надісланий ще раз, дату лишають.
 */
export function translationTextUpdatedAt(input: {
  /** Збережений переклад цією мовою; `undefined` — переклад новий */
  saved: (TranslationText & { updatedAt: Date }) | undefined;
  requested: TranslationText;
  now: Date;
}): Date {
  const { saved, requested, now } = input;
  return !saved || isTextChanged(saved, requested) ? now : saved.updatedAt;
}

/** Набір зв'язків — порядок не важить (масив у `PUT` замінює зв'язки повністю). */
function changesIdSet(
  current: readonly string[],
  requested: readonly string[] | undefined,
): boolean {
  if (requested === undefined) return false;
  const currentIds = new Set(current);
  return (
    requested.length !== currentIds.size ||
    requested.some((id) => !currentIds.has(id))
  );
}

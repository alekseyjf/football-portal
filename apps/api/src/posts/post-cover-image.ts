import type { PostStatus } from '@prisma/client';
import { requestedOrCurrent } from './post-field-update';
import { isLivePostStatus } from './post-visibility';

export type PostCoverImageErrorCode =
  | 'COVER_IMAGE_ALT_REQUIRED'
  | 'COVER_IMAGE_CREDIT_REQUIRED';

/** Обкладинка поста, як вона збережена. */
export interface PostCoverImageState {
  /** `null` — обкладинки немає */
  coverImageUrl: string | null;
  coverImageCredit: string | null;
  /** Опис для незрячих — у кожному перекладі поста */
  translations: readonly {
    languageCode: string;
    coverImageAlt: string | null;
  }[];
}

/** Обкладинка з запиту: `undefined` — не передано (не змінювати), `null` — прибрати. */
export interface PostCoverImageRequest {
  coverImageUrl?: string | null;
  coverImageCredit?: string | null;
  translations?: readonly {
    languageCode: string;
    coverImageAlt?: string | null;
  }[];
}

export interface PostCoverImageInput {
  /** `null` — пост створюється */
  current: PostCoverImageState | null;
  requested: PostCoverImageRequest;
  /** Статус після запиту — з `resolvePostPublication` */
  status: PostStatus;
  /** Увімкнені мови: переклад вимкненою мовою сайт не показує, і опис йому не задати (P3-3) */
  activeLanguageCodes: ReadonlySet<string>;
}

/** Що сталося з фото обкладинки після запиту. */
export interface PostCoverImagePhoto {
  hasCoverImage: boolean;
  /** Адреса та сама (або фото не було й немає): наявні опис і підпис лишаються */
  isSamePhoto: boolean;
}

export type PostCoverImageResult =
  | ({ isValid: true } & PostCoverImagePhoto)
  | { isValid: false; errorCode: PostCoverImageErrorCode };

/**
 * Обкладинка після створення / оновлення (D44):
 * - опис і підпис — про конкретне фото: нове фото (інша адреса) наявних не успадковує, а без фото
 *   вони не зберігаються — що саме записати, вирішує `coverImageTextToStore`;
 * - опублікована або запланована новина з обкладинкою — опис у кожному перекладі увімкненою мовою
 *   й підпис автора фото; чернетка й архівна можуть бути неповними, як переклад UK (D23).
 */
export function resolvePostCoverImage(
  input: PostCoverImageInput,
): PostCoverImageResult {
  const { current, requested, status } = input;
  const currentUrl = current?.coverImageUrl ?? null;
  const coverImageUrl = requestedOrCurrent(requested.coverImageUrl, currentUrl);
  const photo: PostCoverImagePhoto = {
    hasCoverImage: coverImageUrl !== null,
    isSamePhoto: coverImageUrl === currentUrl,
  };
  if (!photo.hasCoverImage || !isLivePostStatus(status)) {
    return { isValid: true, ...photo };
  }

  if (resultingAlts(input, photo.isSamePhoto).includes(null)) {
    return invalid('COVER_IMAGE_ALT_REQUIRED');
  }
  const currentCredit = photo.isSamePhoto ? current?.coverImageCredit : null;
  if (requestedOrCurrent(requested.coverImageCredit, currentCredit) === null) {
    return invalid('COVER_IMAGE_CREDIT_REQUIRED');
  }
  return { isValid: true, ...photo };
}

/**
 * Що записати в опис чи підпис (D44); `undefined` — колонку не чіпати:
 * - те саме фото — передане значення (не передано — лишається наявне);
 * - нове фото — лише передане: опис попереднього фото не переносимо;
 * - фото прибрали — очистити; фото не було й немає — нічого не писати.
 */
export function coverImageTextToStore(
  requestedValue: string | null | undefined,
  photo: PostCoverImagePhoto,
): string | null | undefined {
  if (!photo.hasCoverImage) return photo.isSamePhoto ? undefined : null;
  return photo.isSamePhoto ? requestedValue : (requestedValue ?? null);
}

/**
 * Опис кожного перекладу увімкненою мовою після запиту — наявні переклади поста й нові з запиту;
 * наявний опис лишається, лише поки фото те саме.
 */
function resultingAlts(
  { current, requested, activeLanguageCodes }: PostCoverImageInput,
  keepsCurrentAlts: boolean,
): (string | null)[] {
  const altByLanguage = new Map<string, string | null>(
    current?.translations.map((translation) => [
      translation.languageCode,
      keepsCurrentAlts ? translation.coverImageAlt : null,
    ]),
  );
  for (const translation of requested.translations ?? []) {
    altByLanguage.set(
      translation.languageCode,
      requestedOrCurrent(
        translation.coverImageAlt,
        altByLanguage.get(translation.languageCode),
      ),
    );
  }
  return [...altByLanguage]
    .filter(([languageCode]) => activeLanguageCodes.has(languageCode))
    .map(([, alt]) => alt);
}

function invalid(errorCode: PostCoverImageErrorCode): PostCoverImageResult {
  return { isValid: false, errorCode };
}

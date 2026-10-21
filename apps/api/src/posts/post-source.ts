import { requestedOrCurrent } from './post-field-update';

export type PostSourceErrorCode = 'SOURCE_URL_REQUIRED';

/** Джерело новини, як воно збережене: одне на пост (D26, спрощено). */
export interface PostSourceState {
  sourceUrl: string | null;
  sourceName: string | null;
}

/** Джерело з запиту: `undefined` — не передано, `null` — прибрати. */
export interface PostSourceRequest {
  sourceUrl?: string | null;
  sourceName?: string | null;
}

export interface PostSourceInput {
  /** `null` — пост створюється */
  current: PostSourceState | null;
  requested: PostSourceRequest;
}

/** Що записати в колонки джерела; `undefined` — колонку не чіпати. */
export interface PostSourceWrite {
  sourceUrl?: string | null;
  sourceName?: string | null;
}

export type PostSourceResult =
  | { isValid: true; source: PostSourceWrite }
  | { isValid: false; errorCode: PostSourceErrorCode };

/**
 * Джерело після створення / оновлення (D26). Як обкладинка (D44), назва — про конкретну адресу:
 * - не передана назва лишається, поки адреса та сама (та сама адреса в запиті — теж);
 * - інша адреса чи прибрана — старої назви не лишаємо: інша стаття може бути іншого видання, а чужа
 *   назва біля посилання — хибне джерело. Тож `sourceUrl: null` прибирає джерело цілком;
 * - назва без адреси після запиту — `SOURCE_URL_REQUIRED`; адреса без назви — можна: сайт покаже домен.
 */
export function resolvePostSource({
  current,
  requested,
}: PostSourceInput): PostSourceResult {
  const currentUrl = current?.sourceUrl ?? null;
  const sourceUrl = requestedOrCurrent(requested.sourceUrl, currentUrl);
  const isSameUrl = sourceUrl === currentUrl;
  const sourceName = requestedOrCurrent(
    requested.sourceName,
    isSameUrl ? current?.sourceName : null,
  );
  if (sourceName !== null && sourceUrl === null) {
    return { isValid: false, errorCode: 'SOURCE_URL_REQUIRED' };
  }
  return {
    isValid: true,
    source: {
      sourceUrl: requested.sourceUrl,
      // Назву не передано, а адреса та сама — колонку не чіпаємо; інша адреса — запис без старої назви
      sourceName:
        requested.sourceName === undefined && isSameUrl
          ? undefined
          : sourceName,
    },
  };
}

import { PostStatus } from '@prisma/client';

/*
 * Події опублікованої новини (D57): з'явилась на сайті, змінилась чи зникла. Їх слухає сповіщення сайту (вебхук →
 * кеш сторінок і sitemap); шле лише той, хто справді змінив стан, і лише після коміту транзакції — підписник не бачить
 * незакоміченого й не може відкотити запис.
 */

/** Новина стала PUBLISHED: ручна публікація або воркер розкладу — та сама подія. */
export const POST_PUBLISHED_EVENT = 'post.published';
/**
 * Жива новина змінила те, що бачить читач: текст, заголовок, обкладинку, теги, переклад — або адресу (новий slug;
 * старий веде на нього 308 за номером, D24).
 */
export const POST_UPDATED_EVENT = 'post.updated';
/** Новина зникла з сайту: в архів, у чернетки, видалили. */
export const POST_UNPUBLISHED_EVENT = 'post.unpublished';

export type PostEventName =
  | typeof POST_PUBLISHED_EVENT
  | typeof POST_UPDATED_EVENT
  | typeof POST_UNPUBLISHED_EVENT;

/** Новина, про яку подія: адреса `/{locale}/news/{slug}-{number}` — з поточним slug-ом. */
export interface PostRef {
  /** Id новини (`Post.id`) */
  id: string;
  number: number;
  slug: string;
}

export interface PostEvent {
  name: PostEventName;
  post: PostRef;
}

/** Стан новини для подій; `null` — новини немає (ще не створена чи видалена). */
export interface PostEventState extends PostRef {
  status: PostStatus;
}

/**
 * Подія зміни новини `before` → `after`. Жива — PUBLISHED (D57): чернетка ↔ запланована й перенесення дати подій
 * не дають — на сайті нічого не змінилось. `changesPublicContent` — запис змінив те, що бачить читач
 * (`changesPublicContent` з `post-public-content.ts`): для живої до й після — `post.updated`.
 */
export function postEvents(
  before: PostEventState | null,
  after: PostEventState | null,
  changesPublicContent = false,
): PostEvent[] {
  const wasLive = before?.status === PostStatus.PUBLISHED;
  const isLive = after?.status === PostStatus.PUBLISHED;
  if (!wasLive) {
    return isLive ? [{ name: POST_PUBLISHED_EVENT, post: refOf(after) }] : [];
  }
  if (!isLive) return [{ name: POST_UNPUBLISHED_EVENT, post: refOf(before) }];
  return changesPublicContent
    ? [{ name: POST_UPDATED_EVENT, post: refOf(after) }]
    : [];
}

function refOf(state: PostEventState): PostRef {
  return { id: state.id, number: state.number, slug: state.slug };
}

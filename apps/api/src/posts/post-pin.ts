import { isSamePublication, type PostPublication } from './post-publication';
import { isPostLive } from './post-visibility';

/*
 * Головна новина сайту (D56): редактор закріплює одну живу новину, без неї головна — найсвіжіша. Закріпленою буває
 * лише жива новина, тож зняли з публікації, в архів, перенесли в майбутнє чи видалили — закріплення знімається
 * в тому ж записі, і повернута в публікацію новина не стає головною потай.
 */

/** Новин під головною на головній сторінці сайту (D55): від 1024 px три — поруч із нею, ще три — під ними. */
export const HOME_LATEST_POST_COUNT = 6;

export interface HomePostSelection<Post> {
  /** `null` — живих новин немає */
  lead: Post | null;
  latest: Post[];
}

/**
 * Головна — закріплена, інакше найсвіжіша; під нею — найсвіжіші без неї. `freshest` — щонайменше `latestCount + 1`
 * найсвіжіших: закріплена може бути серед них, тоді її пропускаємо, і дубля немає за побудовою.
 */
export function pickHomePosts<Post extends { id: string }>(
  pinned: Post | null,
  freshest: Post[],
  latestCount: number,
): HomePostSelection<Post> {
  const lead = pinned ?? freshest[0] ?? null;
  return {
    lead,
    latest: freshest
      .filter((post) => post.id !== lead?.id)
      .slice(0, latestCount),
  };
}

/** Новина, яку закріплюють, — заблокований рядок, не видалена. */
export interface PinTarget extends PostPublication {
  pinnedAt: Date | null;
}

export interface PinRequest {
  target: PinTarget;
  /** Закріплена зараз (після блокування); `null` — жодної */
  currentPinnedPostId: string | null;
  /** Яку новину редактор замінює — з тексту підтвердження в адмінці; `null` — «закріпленої немає» */
  replacesPostId: string | null;
  now: Date;
}

export type PinDecision =
  /** Новина вже закріплена — нічого не змінювати (хто й коли закріпив — лишаються) */
  | { kind: 'alreadyPinned' }
  /** Закріпити; `unpinPostId` — спершу зняти цю */
  | { kind: 'pin'; unpinPostId: string | null }
  | { kind: 'rejected'; errorCode: 'POST_NOT_LIVE' | 'PINNED_POST_CHANGED' };

/**
 * Чи закріплювати (D56). Лише жива новина: чернетка, ще не випущена запланована, архівна — `POST_NOT_LIVE` (інакше
 * до виходу запланованої головною тихо стала б найсвіжіша). Заміна — лише та, яку редактор підтвердив: закріплена
 * встигла змінитись (друга вкладка, інший редактор) — `PINNED_POST_CHANGED`, адмінка питає заново.
 */
export function decidePin(request: PinRequest): PinDecision {
  const { target, currentPinnedPostId, replacesPostId, now } = request;
  if (!isPostLive({ ...target, deletedAt: null }, now)) {
    return { kind: 'rejected', errorCode: 'POST_NOT_LIVE' };
  }
  if (target.pinnedAt !== null) return { kind: 'alreadyPinned' };
  if (currentPinnedPostId !== replacesPostId) {
    return { kind: 'rejected', errorCode: 'PINNED_POST_CHANGED' };
  }
  return { kind: 'pin', unpinPostId: currentPinnedPostId };
}

/**
 * Чи зняти закріплення разом з оновленням новини: публікація змінилась, і новина перестала бути живою — зняли
 * з публікації, в архів, перенесли в майбутнє. Публікація та сама (правка тексту) — закріплення не чіпаємо.
 */
export function unpinsOnPublicationChange(change: {
  current: PostPublication;
  next: PostPublication;
  now: Date;
}): boolean {
  if (isSamePublication(change.current, change.next)) return false;
  return !isPostLive({ ...change.next, deletedAt: null }, change.now);
}

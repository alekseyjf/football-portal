import { adminAuthorName, type AdminPost, type PinnedAdminPost } from '@/lib/api/types';

/*
 * Головна новина сайту (D56): редактор закріплює одну живу новину. Стан закріплення в адмінці — лише з відповіді API
 * (`POST` / `DELETE /posts/{id}/pin` віддають рядок новини), не оптимістично; закріплена на сайт одна, тож закріпили
 * одну — решта в кеші вже не закріплені.
 */

/** Поля закріплення — однакові в рядку списку й у новині для форми. */
export type PinState = Pick<AdminPost, 'id' | 'pinnedAt' | 'pinnedBy'>;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Від більшої одиниці до меншої: перша, якої минуло хоча б одна ціла, — «2 days ago», «5 minutes ago». */
const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * DAY_MS],
  ['month', 30 * DAY_MS],
  ['week', 7 * DAY_MS],
  ['day', DAY_MS],
  ['hour', HOUR_MS],
  ['minute', MINUTE_MS],
];

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

/** Скільки минуло: «2 days ago», «1 hour ago»; менше хвилини — «just now». */
export function timeAgo(isoDate: string, now: Date): string {
  const elapsedMs = Math.max(0, now.getTime() - Date.parse(isoDate));
  for (const [unit, unitMs] of RELATIVE_TIME_UNITS) {
    if (elapsedMs >= unitMs) return RELATIVE_TIME_FORMAT.format(-Math.floor(elapsedMs / unitMs), unit);
  }
  return 'just now';
}

/**
 * Хто закріпив — «Pinned by Olena Editor»; анонімізований акаунт — «Deleted user»; рядок `User` видалено фізично
 * (`pinnedBy: null`) — просто «Pinned». `null` — не закріплена.
 */
export function pinnedByText(pin: Pick<PinState, 'pinnedAt' | 'pinnedBy'>): string | null {
  if (!pin.pinnedAt) return null;
  return pin.pinnedBy ? `Pinned by ${adminAuthorName(pin.pinnedBy)}` : 'Pinned';
}

export type PinStep =
  /** Закріплювати одразу: закріпленої немає (чи це вона сама) — заміни немає, питати нічого */
  | { kind: 'pin'; replacesPostId: string | null }
  /** Спершу спитати: закріплення замінить цю */
  | { kind: 'confirmReplace'; current: AdminPost };

/** Що робити з натисканням Pin, коли закріплена зараз — `currentPinned` (свіжа з API). */
export function pinStepFor(postId: string, currentPinned: AdminPost | null): PinStep {
  if (!currentPinned || currentPinned.id === postId) {
    return { kind: 'pin', replacesPostId: currentPinned?.id ?? null };
  }
  return { kind: 'confirmReplace', current: currentPinned };
}

/**
 * Новина в кеші після закріплення чи відкріплення `changedPost`: сама вона — з відповіді, а закріпили її — решта
 * не закріплені (на сайт одна). Не змінилась — той самий об'єкт.
 */
export function withPinChange<Post extends PinState>(post: Post, changedPost: AdminPost): Post {
  if (post.id === changedPost.id) {
    return { ...post, pinnedAt: changedPost.pinnedAt, pinnedBy: changedPost.pinnedBy };
  }
  if (changedPost.pinnedAt && post.pinnedAt) return { ...post, pinnedAt: null, pinnedBy: null };
  return post;
}

/**
 * Новина в кеші, коли з API відомо, яка закріплена зараз (`GET /posts/admin/pinned`): закріплена — з відповіді, решта —
 * не закріплені. Так список не показує старої закріпленої, поки діалог питає про нову (друга вкладка, інший редактор).
 */
export function withCurrentPinned<Post extends PinState>(post: Post, currentPinned: AdminPost | null): Post {
  if (currentPinned) return withPinChange(post, currentPinned);
  return post.pinnedAt ? { ...post, pinnedAt: null, pinnedBy: null } : post;
}

/** Закріплена після зміни: закріпили — вона; відкріпили закріплену — жодної; інакше — без змін. */
export function pinnedAfterChange(
  current: PinnedAdminPost | undefined,
  changedPost: AdminPost,
): PinnedAdminPost | undefined {
  if (changedPost.pinnedAt) return { post: changedPost };
  if (current?.post?.id === changedPost.id) return { post: null };
  return current;
}

import { POST_NUMBER_MAX } from '@football-portal/validation';

/** Новина в URL (D24): сегмент `{slug}-{number}` — `arsenal-beat-chelsea-1042`. */
export interface PostPathRef {
  slug: string;
  number: number;
}

/** Номер — цифри після останнього дефіса: slug теж може закінчуватись цифрами (`top-10-42`). */
const POST_PATH_SEGMENT = /^(.*)-(\d+)$/;

export function postPathSegment(post: PostPathRef): string {
  return `${post.slug}-${post.number}`;
}

/**
 * Сегмент `{slug}-{number}` → slug і номер; `null` — такої сторінки немає (404): без номера або номер поза
 * межами `Post.number` (старі URL з таймстемпом: `…-1775675859414`). Чи slug канонічний — вирішує сторінка.
 */
export function parsePostPathSegment(segment: string): PostPathRef | null {
  const match = POST_PATH_SEGMENT.exec(segment);
  if (!match) return null;
  const postNumber = Number(match[2]);
  if (postNumber < 1 || postNumber > POST_NUMBER_MAX) return null;
  return { slug: match[1], number: postNumber };
}

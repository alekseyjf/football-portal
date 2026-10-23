import type { AdminPostDetail } from '@/lib/api/types';
import { formatEditorDateTime } from '@/lib/editorDateTime';
import type { PostPublication } from './postFormSchema';

export interface PublicationOption {
  value: PostPublication;
  label: string;
  hint: string;
}

/** Що про новину треба знати варіантам статусу; `null` — новина ще не збережена. */
export type PublicationState = Pick<AdminPostDetail, 'status' | 'isLive' | 'publishedAt'>;

interface PublicationOptionsContext {
  now: Date;
  /** Пояс редактора — для дат у підказках */
  timeZone: string;
}

const DRAFT: PublicationOption = { value: 'DRAFT', label: 'Draft', hint: 'Not visible on the site' };
const PUBLISH_NOW: PublicationOption = { value: 'PUBLISHED', label: 'Publish now', hint: 'Visible immediately' };
const SCHEDULE: PublicationOption = { value: 'SCHEDULED', label: 'Schedule', hint: 'Goes live at the chosen time' };

/**
 * Варіанти статусу у формі (👤 M1.5.2, D50) — за тим, що з новиною зараз:
 * - нова, чернетка чи запланована, що чекає, — Draft / Publish now / Schedule;
 * - на сайті — лише Published або зняти з публікації (Archived, D43), без Draft: він стирає дату, і повторна
 *   публікація підняла б стару новину як свіжу;
 * - архівна — назад на сайт зі своєю датою або в чернетки (дата стирається).
 */
export function publicationOptionsFor(
  post: PublicationState | null,
  { now, timeZone }: PublicationOptionsContext,
): PublicationOption[] {
  if (!post || (!post.isLive && post.status !== 'ARCHIVED')) return [DRAFT, PUBLISH_NOW, SCHEDULE];

  // У живої новини дата є завжди (CHECK `Post_published_has_date_check`)
  const publishedAt = post.publishedAt ? formatEditorDateTime(post.publishedAt, timeZone) : null;
  if (post.isLive) {
    return [
      { value: 'PUBLISHED', label: 'Published', hint: `On the site since ${publishedAt}` },
      {
        value: 'ARCHIVED',
        label: 'Unpublish',
        hint: 'Archived: off the site, the address returns 404; it can return with the same date',
      },
    ];
  }

  // Архівна, знята до свого часу (зі Swagger), дати не збереже: API опублікує її зараз
  const keepsDate = post.publishedAt !== null && new Date(post.publishedAt).getTime() <= now.getTime();
  return [
    { ...DRAFT, hint: 'Clears the publication date: published later, it shows up as new' },
    {
      value: 'PUBLISHED',
      label: 'Publish again',
      hint: keepsDate ? `Back on the site with its date, ${publishedAt}` : 'Visible immediately',
    },
    { value: 'ARCHIVED', label: 'Archived', hint: 'Off the site: the address returns 404' },
  ];
}

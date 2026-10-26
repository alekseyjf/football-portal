import { editorTimeZone, formatEditorDateTime } from '@/lib/editorDateTime';
import { pinnedByText, timeAgo, type PinState } from '@/lib/pinnedPost';

/** «📌 Pinned by Olena Editor · 2 days ago» — закріплена головною на сайті (D56); точний час — у підказці. */
export function PinnedBadge({ post }: { post: Pick<PinState, 'pinnedAt' | 'pinnedBy'> }) {
  const byText = pinnedByText(post);
  if (!byText || !post.pinnedAt) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-1 text-xs text-sky-300">
      <span aria-hidden="true">📌</span>
      <span>
        {byText} ·{' '}
        <time dateTime={post.pinnedAt} title={formatEditorDateTime(post.pinnedAt, editorTimeZone())}>
          {timeAgo(post.pinnedAt, new Date())}
        </time>
      </span>
    </span>
  );
}

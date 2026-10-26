'use client';

import { PinnedBadge } from '@/components/pin/PinnedBadge';
import { PinPostControl } from '@/components/pin/PinPostControl';
import { useAdminPost } from '@/hooks/useAdminPost';
import type { AdminPostDetail } from '@/lib/api/types';

const SECTION_TITLE_ID = 'pin-post-heading';

function pinSectionNote(post: AdminPostDetail): string {
  if (post.pinnedAt) return 'This post is the lead on the home page. Unpin it — and the newest post becomes the lead.';
  if (post.isLive) return 'Pin this post to make it the lead on the home page. A pinned lead is replaced only after you confirm.';
  return 'Only a post that is on the site can be pinned. Taking a pinned post off the site unpins it.';
}

/**
 * Головна новина сайту (D56) — окремою секцією, як видалення, а не полем форми: закріплення зберігається одразу й
 * не плутається з незбереженими змінами. Стан — з кешу новини, куди кладе відповідь `POST` / `DELETE /posts/{id}/pin`
 * (знімок форми `savedPost` закріплення не бачить).
 */
export function PinPostSection({ post: savedPost }: { post: AdminPostDetail }) {
  const { data: post = savedPost } = useAdminPost(savedPost.id);
  return (
    <section aria-labelledby={SECTION_TITLE_ID} className="mt-10 rounded-xl border border-sky-500/30 p-4">
      <h2 id={SECTION_TITLE_ID} className="text-sm font-semibold text-sky-300">
        Home page lead
      </h2>
      {post.pinnedAt && (
        <p className="mt-2">
          <PinnedBadge post={post} />
        </p>
      )}
      <p className="mt-1 text-sm text-gray-400">{pinSectionNote(post)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <PinPostControl
          post={post}
          buttonClassName="rounded-lg border border-sky-500/60 px-4 py-2 text-sm text-sky-300 transition-colors hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </section>
  );
}

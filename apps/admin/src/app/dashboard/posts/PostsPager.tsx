import type { ReactNode } from 'react';
import { postListHref, type PostListParams } from '@/lib/postListParams';
import { PostListLink } from './PostListLink';

interface PagerLinkProps {
  params: PostListParams;
  page: number;
  isAvailable: boolean;
  children: ReactNode;
}

function PagerLink({ params, page, isAvailable, children }: PagerLinkProps) {
  if (!isAvailable) return <span className="text-gray-600">{children}</span>;
  return (
    <PostListLink
      href={postListHref({ ...params, page })}
      scrollToTop
      className="text-green-400 transition-colors hover:text-green-300"
    >
      {children}
    </PostListLink>
  );
}

/** Сторінки списку — посилання `?page=` у межах фільтра й пошуку: нова вкладка й «Назад» працюють як звично. */
export function PostsPager({ params, totalPages }: { params: PostListParams; totalPages: number }) {
  return (
    <nav aria-label="Posts pages" className="mt-6 flex items-center justify-center gap-6 text-sm">
      <PagerLink params={params} page={params.page - 1} isAvailable={params.page > 1}>
        ← Newer
      </PagerLink>
      <span className="text-gray-400">
        Page {params.page} of {totalPages}
      </span>
      <PagerLink params={params} page={params.page + 1} isAvailable={params.page < totalPages}>
        Older →
      </PagerLink>
    </nav>
  );
}

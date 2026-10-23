'use client';

import type { ComponentProps } from 'react';
import { AdminLink } from '@/components/AdminLink';
import { pushPostListHref } from '@/hooks/usePostListUrl';

type PostListLinkProps = Omit<ComponentProps<typeof AdminLink>, 'href' | 'onNavigate' | 'prefetch'> & {
  href: string;
  /** Пейджер унизу списку: нова сторінка — з її початку */
  scrollToTop?: boolean;
};

/**
 * Посилання на інший стан списку (фільтр, сторінка, «Show all posts»): справжня адреса — для нової вкладки й
 * копіювання, а клік — новий запис історії без запиту до сервера (`pushState`), тож і без prefetch (D50).
 */
export function PostListLink({ href, scrollToTop = false, ...linkProps }: PostListLinkProps) {
  return (
    <AdminLink
      {...linkProps}
      href={href}
      prefetch={false}
      onNavigate={(event) => {
        event.preventDefault();
        pushPostListHref(href);
        if (scrollToTop) window.scrollTo({ top: 0 });
      }}
    />
  );
}

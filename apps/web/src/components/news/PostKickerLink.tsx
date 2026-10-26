'use client';

import { LinkPendingLabel } from '@/components/layout/LinkPendingLabel';
import { Link } from '@/i18n/navigation';
import type { PostSummary } from '@/lib/api/types';
import { newsFeedHref } from '@/lib/news/news-feed-filters';
import { postKicker } from '@/lib/news/post-kicker';
import { useCollator } from '@/hooks/useCollator';

type Props = {
  post: Pick<PostSummary, 'competitions' | 'tags'>;
  className: string;
};

/**
 * Рубрика над заголовком — на картці й на сторінці новини одна (`postKicker`, D52): посилання у стрічку лише з цим
 * турніром чи тегом. Без рубрики — нічого.
 */
export function PostKickerLink({ post, className }: Props) {
  const collator = useCollator();
  const kicker = postKicker(post, collator);
  if (!kicker) return null;

  return (
    <Link href={newsFeedHref(kicker.filters)} className={className}>
      <LinkPendingLabel>{kicker.name}</LinkPendingLabel>
    </Link>
  );
}

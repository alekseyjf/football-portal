import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { LinkPendingLabel } from '@/components/layout/LinkPendingLabel';
import { Link } from '@/i18n/navigation';
import type { PostDetail } from '@/lib/api/types';
import { postTopicLinks } from '@/lib/news/post-topics';
import { useCollator } from '@/hooks/useCollator';

type Props = {
  post: Pick<PostDetail, 'competitions' | 'clubs' | 'tags'>;
};

/**
 * Теми новини внизу статті (M1.6.2): усі турніри, клуби й теги — чипами-посиланнями у стрічку з одним фільтром. На
 * картці стрічки — лише рубрика (D52), тож усі теми — тут.
 */
export function PostTopics({ post }: Props) {
  const t = useTranslations('news');
  const collator = useCollator();
  const headingId = useId();
  const topics = postTopicLinks(post, collator);
  if (topics.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2
        id={headingId}
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400"
      >
        {t('topics')}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <li key={topic.key}>
            <Link
              href={topic.href}
              className="inline-flex rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-sm text-gray-200 transition-colors hover:border-gray-500 hover:text-white"
            >
              <LinkPendingLabel>{topic.name}</LinkPendingLabel>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

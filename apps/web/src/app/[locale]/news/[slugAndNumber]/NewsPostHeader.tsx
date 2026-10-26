import { useTranslations } from 'next-intl';
import { PostKickerLink } from '@/components/news/PostKickerLink';
import type { PostDetail } from '@/lib/api/types';
import { useAuthorDisplayName } from '@/hooks/useAuthorDisplayName';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';

type Props = {
  post: Pick<
    PostDetail,
    | 'competitions'
    | 'tags'
    | 'title'
    | 'excerpt'
    | 'resolvedLanguage'
    | 'author'
    | 'publishedAt'
  >;
};

/**
 * Верх новини: рубрика (та сама, що на картці, — посилання у стрічку), заголовок, анонс, автор і час публікації.
 * `lang` — на заголовку й анонсі: без перекладу вони мовою оригіналу, а автор і дата — мовою сторінки.
 */
export function NewsPostHeader({ post }: Props) {
  const t = useTranslations('news');
  const formatDate = useDateTimeFormat();
  const authorDisplayName = useAuthorDisplayName();

  return (
    <header className="mb-8">
      <PostKickerLink
        post={post}
        className="mb-3 inline-block text-xs font-semibold uppercase tracking-wide text-green-400 hover:text-green-300 hover:underline"
      />
      <h1
        lang={post.resolvedLanguage}
        className="mb-4 text-3xl font-bold leading-tight text-white sm:text-4xl"
      >
        {post.title}
      </h1>
      <p
        lang={post.resolvedLanguage}
        className="mb-5 border-l-4 border-green-500 pl-4 text-lg leading-relaxed text-gray-300"
      >
        {post.excerpt}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-400">
        <span>
          {t('by')} {authorDisplayName(post.author)}
        </span>
        <span aria-hidden="true">·</span>
        <time dateTime={post.publishedAt}>
          {formatDate(post.publishedAt, {
            dateStyle: 'long',
            timeStyle: 'short',
          })}
        </time>
      </p>
    </header>
  );
}

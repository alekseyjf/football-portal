'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { MarkdownContent } from '@football-portal/ui';
import { parseYouTubeVideoId } from '@football-portal/validation';
import { contentLanguageName } from '@/lib/i18n/content-lang';
import { postDetailQueryOptions } from '@/hooks/usePostDetail';
import { useApiContentLang } from '@/hooks/useApiContentLang';
import { LikeBar } from '@/components/features/LikeBar';
import { CommentSection } from './CommentSection';
import { NewsPostHeader } from './NewsPostHeader';
import { NewsPostLoadError } from './NewsPostLoadError';
import { NewsPostSkeleton } from './NewsPostSkeleton';
import { PostBreadcrumbs } from './PostBreadcrumbs';
import { PostCover } from './PostCover';
import { PostSourceLine } from './PostSourceLine';
import { PostTopics } from './PostTopics';
import { PostVideo } from './PostVideo';

const PAGE_CLASS = 'max-w-3xl mx-auto px-4 py-8';

/**
 * Сторінка новини (M1.6.2): хлібні крихти, верх (рубрика, заголовок, анонс, автор), головне медіа (відео, а без нього —
 * обкладинка), текст у Markdown,
 * джерело, теми, лайки й коментарі. Дані — з кешу, який наповнив сервер; без них (сервер не дочекався API) клієнт
 * вантажить сам — скелетон, помилка — «Спробувати ще».
 */
type Props = {
  postNumber: number;
  /** Адреса сайту (`SITE_URL`) — посилання тексту на неї відкриваються в тій самій вкладці */
  siteUrl: string;
};

export function NewsPostView({ postNumber, siteUrl }: Props) {
  const contentLang = useApiContentLang();
  const locale = useLocale();
  const t = useTranslations('news');
  const postQuery = useQuery(postDetailQueryOptions(postNumber, contentLang));
  const post = postQuery.data;

  // Уже показану новину невдалий фоновий refetch не замінює
  if (!post) {
    const hasLoadError = postQuery.isError && !postQuery.isFetching;
    return (
      <main className={PAGE_CLASS}>
        {hasLoadError ? (
          <NewsPostLoadError onRetry={() => postQuery.refetch()} />
        ) : (
          <NewsPostSkeleton />
        )}
      </main>
    );
  }

  const isFallback = post.resolvedLanguage !== contentLang;
  // API зберігає відео канонічним (D54); не YouTube (запис в обхід API) — без плеєра
  const videoId = post.videoUrl ? parseYouTubeVideoId(post.videoUrl) : null;

  return (
    <main className={PAGE_CLASS}>
      <PostBreadcrumbs title={post.title} titleLang={post.resolvedLanguage} />

      {isFallback && (
        <p
          role="note"
          className="mb-6 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-300"
        >
          {t('translationUnavailable', {
            language: contentLanguageName(post.resolvedLanguage, locale),
          })}
        </p>
      )}

      <article>
        <NewsPostHeader post={post} />
        {/* Відео — головне медіа замість обкладинки (D54): обкладинка стає його прев'ю */}
        {videoId ? <PostVideo videoId={videoId} post={post} /> : <PostCover post={post} />}

        {/* Текст — мовою перекладу; підпис «відкривається в новій вкладці» — мовою сторінки */}
        <div lang={post.resolvedLanguage}>
          <MarkdownContent
            source={post.content}
            siteUrl={siteUrl}
            newTabLabel={{ text: t('opensInNewTab'), lang: locale }}
          />
        </div>

        <PostSourceLine sourceUrl={post.sourceUrl} sourceName={post.sourceName} />
        <PostTopics post={post} />

        <div className="mt-8 flex items-center">
          <LikeBar targetType="post" targetId={post.id} />
        </div>
      </article>

      <hr className="border-gray-800 my-10" />

      <CommentSection postId={post.id} />
    </main>
  );
}

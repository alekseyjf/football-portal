import { isAllowedCoverImageUrl } from '@football-portal/validation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { PostDetail } from '@/lib/api/types';

type Props = {
  post: Pick<
    PostDetail,
    'coverImageUrl' | 'coverImageAlt' | 'coverImageCredit' | 'resolvedLanguage'
  >;
};

/**
 * Обкладинка з підписом автора (D44): 16 : 9, як рекомендований розмір 1200×630 (editor-guide.md), — без стрибка
 * сторінки, поки фото вантажиться. Найбільший елемент першого екрана (LCP) — вантажиться одразу й першим.
 */
export function PostCover({ post }: Props) {
  const t = useTranslations('news');
  if (!post.coverImageUrl) return null;

  return (
    <figure className="mb-8">
      {/* Опис фото — мовою тексту (D44), звідси `lang`; підпис «Фото: …» — мовою сторінки */}
      <div
        className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-900"
        lang={post.resolvedLanguage}
      >
        <Image
          src={post.coverImageUrl}
          // Без опису — порожній, а не заголовок: його й так прочитає h1
          alt={post.coverImageAlt ?? ''}
          fill
          // Фото з фотобанку — через оптимізатор (M1.8.3a): розмір під екран і WebP; збережене раніше з іншого хоста — як є
          unoptimized={!isAllowedCoverImageUrl(post.coverImageUrl)}
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 768px) 768px, 100vw"
          className="object-cover"
        />
      </div>
      {post.coverImageCredit && (
        <figcaption className="mt-2 text-xs text-gray-400">
          {t('photoCredit', { credit: post.coverImageCredit })}
        </figcaption>
      )}
    </figure>
  );
}

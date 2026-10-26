import type { Metadata } from 'next';
import type { PostDetail } from '@/lib/api/types';

type MetadataSource = Pick<
  PostDetail,
  'title' | 'excerpt' | 'publishedAt' | 'coverImageUrl' | 'coverImageAlt'
>;

/**
 * Метадані новини (M1.6.2): опис — анонс (D25), прев'ю в соцмережах — заголовок, анонс і обкладинка з описом; без
 * обкладинки — без картинки, а не логотип. Теги X Next будує з `openGraph` сам: з картинкою — велика картка
 * (`summary_large_image`). `canonical`, `hreflang`, `og:locale` — разом з рештою SEO (M1.8, D34).
 */
export function postMetadata(post: MetadataSource): Metadata {
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
      images: post.coverImageUrl
        ? [{ url: post.coverImageUrl, alt: post.coverImageAlt ?? undefined }]
        : undefined,
    },
  };
}

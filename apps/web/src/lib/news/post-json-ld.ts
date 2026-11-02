import { articleImageUrls } from '@football-portal/validation';
import type { BreadcrumbList, NewsArticle, WithContext } from 'schema-dts';
import type { AppLocale } from '@/i18n/routing';
import type { PostDetail } from '@/lib/api/types';
import { breadcrumbListJsonLd, newsArticleJsonLd } from '@/lib/seo/json-ld';
import {
  absoluteUrl,
  canonicalPath,
  localizedPath,
} from '@/lib/seo/page-metadata';
import { postLanguages } from './post-metadata';
import { postHref } from './post-path';

type PostJsonLdSource = Pick<
  PostDetail,
  | 'number'
  | 'slug'
  | 'title'
  | 'excerpt'
  | 'coverImageUrl'
  | 'publishedAt'
  | 'lastModifiedAt'
  | 'author'
  | 'resolvedLanguage'
  | 'sourceUrl'
  | 'availableLanguages'
>;

export type PostJsonLdPage = {
  locale: AppLocale;
  /** Адреса сайту (`SITE_URL`) */
  siteOrigin: string;
  siteName: string;
  /** Назви пунктів хлібних крихт мовою сторінки (`news.breadcrumbs.*`) */
  breadcrumbNames: { home: string; news: string };
};

/**
 * Структуровані дані новини (D34, D53). `NewsArticle` описує статтю за канонічною адресою — тією самою, що `canonical`
 * метаданих: `/uk/…` без перекладу показує англійський текст, тож і `url`, і мова — англійські. Дата зміни — та сама,
 * що `article:modified_time` і `lastmod` адреси в sitemap (`lastModifiedAt`, OQ-26). `BreadcrumbList` — ті самі пункти й
 * назви, що видимі хлібні крихти (`PostBreadcrumbs`), адреси — мовою сторінки.
 */
export function postJsonLd(
  post: PostJsonLdSource,
  page: PostJsonLdPage,
): {
  article: WithContext<NewsArticle>;
  breadcrumbs: WithContext<BreadcrumbList>;
} {
  const pageUrl = (pathname: string) => absoluteUrl(page.siteOrigin, pathname);
  const articleUrl = pageUrl(
    canonicalPath(postHref(post), page.locale, postLanguages(post)),
  );
  return {
    article: newsArticleJsonLd({
      url: articleUrl,
      headline: post.title,
      description: post.excerpt,
      imageUrls: post.coverImageUrl ? articleImageUrls(post.coverImageUrl) : [],
      datePublished: post.publishedAt,
      dateModified: post.lastModifiedAt,
      authorName: post.author.isDeleted ? null : post.author.name,
      publisher: { name: page.siteName, url: page.siteOrigin },
      inLanguage: post.resolvedLanguage,
      sourceUrl: post.sourceUrl,
    }),
    breadcrumbs: breadcrumbListJsonLd([
      {
        name: page.breadcrumbNames.home,
        url: pageUrl(localizedPath('/', page.locale)),
      },
      {
        name: page.breadcrumbNames.news,
        url: pageUrl(localizedPath('/news', page.locale)),
      },
      { name: post.title },
    ]),
  };
}

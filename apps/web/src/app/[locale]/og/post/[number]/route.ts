import { getTranslations } from 'next-intl/server';
import { fetchPostDetail } from '@/hooks/usePostDetail';
import { isAppLocale } from '@/i18n/routing';
import { isApiError } from '@/lib/api/http';
import { localeToApiContentLang, localeToBcp47 } from '@/lib/i18n/content-lang';
import { postKicker } from '@/lib/news/post-kicker';
import { shareCardNotFound, shareCardResponse } from '@/lib/seo/og-card';
import { parseShareCardPostNumber } from '@/lib/seo/share-card';

type Context = { params: Promise<{ locale: string; number: string }> };

/**
 * Картка прев'ю новини без обкладинки (M1.8.1): заголовок, над ним — рубрика, як на картці стрічки (без неї —
 * «Новини»). Новини немає (чернетка, видалена) — 404; інший збій API — 500, і картку соцмережа спитає пізніше.
 */
export async function GET(_request: Request, { params }: Context) {
  const { locale, number } = await params;
  const postNumber = parseShareCardPostNumber(number);
  if (!isAppLocale(locale) || postNumber === null) return shareCardNotFound();

  try {
    const post = await fetchPostDetail(
      postNumber,
      localeToApiContentLang(locale),
    );
    const tMeta = await getTranslations({ locale, namespace: 'meta' });
    const tFeed = await getTranslations({ locale, namespace: 'newsFeed' });
    const kicker = postKicker(post, new Intl.Collator(localeToBcp47(locale)));
    return shareCardResponse({
      siteName: tMeta('title'),
      label: kicker?.name ?? tFeed('title'),
      title: post.title,
    });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return shareCardNotFound();
    throw error;
  }
}

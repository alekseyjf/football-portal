import { getTranslations } from 'next-intl/server';
import { isAppLocale, type AppLocale } from '@/i18n/routing';
import {
  shareCardNotFound,
  shareCardResponse,
  type ShareCardContent,
} from '@/lib/seo/og-card';
import { isShareCardPage, type ShareCardPage } from '@/lib/seo/share-card';

type Context = { params: Promise<{ locale: string; page: string }> };

/** Розділ сайту — над текстом, опис сторінки — великим (головна — без розділу). */
async function pageCardContent(
  locale: AppLocale,
  page: ShareCardPage,
): Promise<ShareCardContent> {
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const siteName = tMeta('title');
  if (page === 'home') {
    const t = await getTranslations({ locale, namespace: 'home' });
    return { siteName, label: null, title: t('metaDescription') };
  }
  const t = await getTranslations({
    locale,
    namespace: page === 'news' ? 'newsFeed' : 'matches',
  });
  return {
    siteName,
    label: t('title'),
    title: t(page === 'news' ? 'description' : 'metaDescription'),
  };
}

/** Картка прев'ю сторінки без власних даних — головна, стрічка, матчі (M1.8.1). */
export async function GET(_request: Request, { params }: Context) {
  const { locale, page } = await params;
  if (!isAppLocale(locale) || !isShareCardPage(page)) {
    return shareCardNotFound();
  }
  return shareCardResponse(await pageCardContent(locale, page));
}

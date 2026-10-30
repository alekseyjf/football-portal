import { getTranslations } from 'next-intl/server';
import { fetchMatchDetail } from '@/hooks/useFootball';
import { isAppLocale } from '@/i18n/routing';
import { isApiError } from '@/lib/api/http';
import { matchTitle } from '@/lib/football/match-title';
import { shareCardNotFound, shareCardResponse } from '@/lib/seo/og-card';

type Context = { params: Promise<{ locale: string; id: string }> };

/**
 * Картка прев'ю матчу (M1.8.1): «Господарі – Гості», над ними — турнір. Без рахунку: картку тримають у себе соцмережі,
 * а рахунок змінюється. Матчу немає — 404.
 */
export async function GET(_request: Request, { params }: Context) {
  const { locale, id } = await params;
  if (!isAppLocale(locale)) return shareCardNotFound();

  try {
    const match = await fetchMatchDetail(id);
    const tMeta = await getTranslations({ locale, namespace: 'meta' });
    return shareCardResponse({
      siteName: tMeta('title'),
      label: match.league.name,
      title: matchTitle(match),
    });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return shareCardNotFound();
    throw error;
  }
}

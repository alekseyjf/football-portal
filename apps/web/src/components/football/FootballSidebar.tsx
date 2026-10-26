'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { BlockLoadError } from '@/components/layout/BlockLoadError';
import { FootballLeagueSwitcher } from '@/components/football/sidebar/FootballLeagueSwitcher';
import { FootballSidebarNoLeague } from '@/components/football/sidebar/FootballSidebarNoLeague';
import { FootballSidebarRoundsSection } from '@/components/football/sidebar/FootballSidebarRoundsSection';
import { FootballSidebarSkeleton } from '@/components/football/sidebar/FootballSidebarSkeleton';
import { FootballSidebarStandingsPanel } from '@/components/football/sidebar/FootballSidebarStandingsPanel';
import {
  leagueDashboardQueryOptions,
  leaguesQueryOptions,
} from '@/hooks/useFootball';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';
import { useMatchStatusLabel } from '@/hooks/useMatchStatusLabel';
import { useSelectedLeague } from '@/hooks/useSelectedLeague';
import { isApiError } from '@/lib/api/http';
import { inPlayLeaguesWithSelected } from '@/lib/football/in-play-leagues';

type Props = {
  /** Ліга без `?league=` — спершу «у грі» (визначає сервер, `resolveDefaultLeagueSlug`) */
  defaultLeagueSlug: string | null;
};

/**
 * Сайдбар головної: перемикач турнірів, таблиця й тури обраної ліги. Дашборд — з кешу, який наповнив сервер; без нього
 * (сервер не дочекався API) клієнт вантажить сам — скелетон, помилка — «Спробувати ще» лише тут (D55).
 */
export function FootballSidebar({ defaultLeagueSlug }: Props) {
  const formatDateTime = useDateTimeFormat();
  const tFootball = useTranslations('football');
  const formatStatus = useMatchStatusLabel();
  const { leagueSlug, leagueHref, selectLeague } =
    useSelectedLeague(defaultLeagueSlug);

  const formatMatchWhen = (iso: string): string =>
    formatDateTime(iso, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const leagues = useQuery(leaguesQueryOptions());
  const dashboard = useQuery({
    ...leagueDashboardQueryOptions(leagueSlug ?? '__none__'),
    enabled: !!leagueSlug,
  });

  if (!leagueSlug) {
    return <FootballSidebarNoLeague />;
  }

  const selectedLeague =
    leagues.data?.find((league) => league.slug === leagueSlug) ??
    dashboard.data?.league ??
    null;
  // Турніри «у грі» + обраний (D48), як вкладки `/news`: завершений ЧС не стоїть серед ліг, що йдуть
  const switcherLeagues = inPlayLeaguesWithSelected(
    leagues.data ?? [],
    leagueSlug,
    selectedLeague,
  );
  const isLeagueNotFound =
    isApiError(dashboard.error) && dashboard.error.status === 404;
  // Показаний дашборд невдалий фоновий refetch не замінює — помилка лише тоді, коли показувати нічого
  const hasLoadError =
    dashboard.data === undefined && dashboard.isError && !isLeagueNotFound;
  const isDashboardLoading =
    dashboard.isPending || (hasLoadError && dashboard.isFetching);

  return (
    <div className="space-y-5">
      <h2 className="sr-only">{tFootball('sidebarTitle')}</h2>
      <FootballLeagueSwitcher
        leagues={switcherLeagues}
        isLoading={leagues.isLoading}
        isError={leagues.isError}
        selectedLeagueSlug={leagueSlug}
        selectedLeague={selectedLeague}
        leagueHref={leagueHref}
        onSelectLeague={selectLeague}
      />

      {isLeagueNotFound ? (
        <p className="border border-neutral-800 bg-black/85 px-4 py-4 text-xs text-neutral-400 wrap-break-word">
          {tFootball('leagueNotFound', { slug: leagueSlug })}
        </p>
      ) : isDashboardLoading ? (
        <>
          <p role="status" className="sr-only">
            {tFootball('sidebarLoading')}
          </p>
          <FootballSidebarSkeleton />
        </>
      ) : hasLoadError ? (
        <BlockLoadError
          message={tFootball('sidebarLoadError')}
          retryLabel={tFootball('retry')}
          onRetry={() => {
            void dashboard.refetch();
            // Список ліг падає разом з дашбордом — без нього перемикач лишився б із помилкою
            if (leagues.isError) void leagues.refetch();
          }}
          className="border border-neutral-800 bg-black/85 px-4 py-8"
        />
      ) : (
        <>
          <FootballSidebarStandingsPanel
            standingsRows={dashboard.data?.standings ?? []}
            standingsTable={dashboard.data?.standingsTable ?? null}
            seasonLabel={dashboard.data?.season?.label ?? null}
          />

          <FootballSidebarRoundsSection
            sectionHeadingKey="upcomingRounds"
            emptyMessageKey="noUpcoming"
            roundKindKey="upcoming"
            rounds={dashboard.data?.fixtures.upcoming ?? []}
            formatStatus={formatStatus}
            formatMatchWhen={formatMatchWhen}
            roundListKeyPrefix="upcoming"
          />

          <FootballSidebarRoundsSection
            sectionHeadingKey="pastRounds"
            emptyMessageKey="noPast"
            roundKindKey="past"
            rounds={dashboard.data?.fixtures.past ?? []}
            formatStatus={formatStatus}
            formatMatchWhen={formatMatchWhen}
            listClassName="space-y-3 max-h-[520px] overflow-y-auto pr-1"
            roundListKeyPrefix="past"
          />
        </>
      )}
    </div>
  );
}

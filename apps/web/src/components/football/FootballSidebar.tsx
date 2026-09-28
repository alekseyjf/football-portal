'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { FootballLeagueSwitcher } from '@/components/football/sidebar/FootballLeagueSwitcher';
import { FootballSidebarNoLeague } from '@/components/football/sidebar/FootballSidebarNoLeague';
import { FootballSidebarRoundsSection } from '@/components/football/sidebar/FootballSidebarRoundsSection';
import { FootballSidebarStandingsPanel } from '@/components/football/sidebar/FootballSidebarStandingsPanel';
import {
  leagueDashboardQueryOptions,
  leaguesQueryOptions,
} from '@/hooks/useFootball';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';
import { useMatchStatusLabel } from '@/hooks/useMatchStatusLabel';
import { useSelectedLeague } from '@/hooks/useSelectedLeague';
import { isApiError } from '@/lib/api/http';

type Props = {
  /** Ліга без `?league=`: env або перша активна (визначає сервер, `resolveDefaultLeagueSlug`) */
  defaultLeagueSlug: string | null;
};

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
  const isLeagueNotFound =
    isApiError(dashboard.error) && dashboard.error.status === 404;
  const standingsRows = dashboard.data?.standings ?? [];
  const upcoming = dashboard.data?.fixtures.upcoming ?? [];
  const past = dashboard.data?.fixtures.past ?? [];

  return (
    <div className="space-y-5">
      <FootballLeagueSwitcher
        leagues={leagues.data ?? []}
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
      ) : (
        <>
          <FootballSidebarStandingsPanel
            standingsRows={standingsRows}
            standingsTable={dashboard.data?.standingsTable ?? null}
            seasonLabel={dashboard.data?.season?.label ?? null}
            isLoading={dashboard.isLoading}
            isError={dashboard.isError}
          />

          <FootballSidebarRoundsSection
            sectionHeadingKey="upcomingRounds"
            emptyMessageKey="noUpcoming"
            roundKindKey="upcoming"
            rounds={upcoming}
            formatStatus={formatStatus}
            formatMatchWhen={formatMatchWhen}
            isLoading={dashboard.isLoading}
            isError={dashboard.isError}
            roundListKeyPrefix="upcoming"
          />

          <FootballSidebarRoundsSection
            sectionHeadingKey="pastRounds"
            emptyMessageKey="noPast"
            roundKindKey="past"
            rounds={past}
            formatStatus={formatStatus}
            formatMatchWhen={formatMatchWhen}
            isLoading={dashboard.isLoading}
            isError={dashboard.isError}
            listClassName="space-y-3 max-h-[520px] overflow-y-auto pr-1"
            roundListKeyPrefix="past"
          />
        </>
      )}
    </div>
  );
}

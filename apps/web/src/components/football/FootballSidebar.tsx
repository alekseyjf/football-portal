'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { FootballSidebarNoLeague } from '@/components/football/sidebar/FootballSidebarNoLeague';
import { FootballSidebarRoundsSection } from '@/components/football/sidebar/FootballSidebarRoundsSection';
import { FootballSidebarStandingsPanel } from '@/components/football/sidebar/FootballSidebarStandingsPanel';
import { leagueDashboardQueryOptions } from '@/hooks/useFootball';
import type { MatchStatusDto } from '@/lib/api/types';
import { localeToBcp47 } from '@/lib/i18n/content-lang';

type Props = {
  leagueSlug: string | null;
};

export function FootballSidebar({ leagueSlug }: Props) {
  const locale = useLocale();
  const dateLocale = localeToBcp47(locale);
  const tMatch = useTranslations('match');

  const formatMatchWhen = (iso: string): string => {
    const dateValue = new Date(iso);
    return dateValue.toLocaleString(dateLocale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatStatus = (status: MatchStatusDto) => {
    const labels: Record<MatchStatusDto, string> = {
      SCHEDULED: tMatch('status.SCHEDULED'),
      LIVE: tMatch('status.LIVE'),
      FINISHED: tMatch('status.FINISHED'),
      POSTPONED: tMatch('status.POSTPONED'),
      CANCELLED: tMatch('status.CANCELLED'),
    };
    return labels[status] ?? status;
  };

  const dashboard = useQuery({
    ...leagueDashboardQueryOptions(leagueSlug ?? '__none__'),
    enabled: !!leagueSlug,
  });

  if (!leagueSlug) {
    return <FootballSidebarNoLeague />;
  }

  const standingsRows = dashboard.data?.standings ?? [];
  const upcoming = dashboard.data?.fixtures.upcoming ?? [];
  const past = dashboard.data?.fixtures.past ?? [];

  return (
    <div className="space-y-5">
      <FootballSidebarStandingsPanel
        standingsRows={standingsRows}
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
    </div>
  );
}

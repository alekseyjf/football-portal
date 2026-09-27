'use client';

import { useSyncRuns } from '@/hooks/useSyncRuns';
import type { SyncRunRow, SyncRunStats } from '@/lib/api/types';

const STATUS_CLASS: Record<SyncRunRow['status'], string> = {
  RUNNING: 'bg-blue-900/60 text-blue-200',
  SUCCEEDED: 'bg-green-900/60 text-green-200',
  PARTIAL: 'bg-yellow-900/60 text-yellow-200',
  FAILED: 'bg-red-900/60 text-red-200',
};

const SCOPE_LABEL: Record<SyncRunRow['scope'], string> = {
  COMPETITION_FULL: 'Повний',
  MATCHES_LIVE: 'LIVE',
  STANDINGS: 'Таблиця',
};

const TRIGGER_LABEL: Record<SyncRunRow['trigger'], string> = {
  ADMIN: 'адмін',
  CRON: 'cron',
  LIVE_TOUCH: 'сторінка матчу',
};

function formatStartedAt(isoDate: string): string {
  return new Date(isoDate).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(syncRun: SyncRunRow): string {
  if (!syncRun.finishedAt) return '…';
  const durationMs =
    new Date(syncRun.finishedAt).getTime() -
    new Date(syncRun.startedAt).getTime();
  return `${(durationMs / 1000).toFixed(1)} с`;
}

/** Коротко: що записано. `=` — пропущено без змін (payloadHash). */
function summarizeStats(stats: SyncRunStats | null): string {
  if (!stats) return '—';
  const parts = [
    stats.seasonLabel &&
      `сезон ${stats.seasonLabel}${stats.seasonChanged ? ' (новий)' : ''}`,
    `матчі +${stats.matchesCreated} ~${stats.matchesUpdated} =${stats.matchesSkipped}`,
    (stats.clubsCreated > 0 || stats.clubsUpdated > 0) &&
      `клуби +${stats.clubsCreated} ~${stats.clubsUpdated}`,
    stats.standingsRows > 0 && `таблиці: ${stats.standingsRows} рядків`,
    stats.standingsUnavailable && 'таблиць у провайдера немає',
    stats.matchesUndecided > 0 && `без суперника: ${stats.matchesUndecided}`,
    stats.matchesUnknown > 0 && `нових для LIVE: ${stats.matchesUnknown}`,
    stats.matchesFailed + stats.standingsFailed > 0 &&
      `не записано: ${stats.matchesFailed + stats.standingsFailed}`,
    `API: ${stats.apiCalls}`,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Журнал синків (`SyncRun`): статус, тривалість, підсумок, помилка. */
export function SyncRunsTable() {
  const syncRuns = useSyncRuns();

  if (syncRuns.isLoading) {
    return <p className="text-sm text-gray-500">Завантаження журналу…</p>;
  }
  if (syncRuns.isError) {
    return (
      <p className="text-sm text-red-400">
        Не вдалося завантажити журнал: {(syncRuns.error as Error).message}
      </p>
    );
  }
  if (!syncRuns.data?.length) {
    return <p className="text-sm text-gray-500">Синків ще не було.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-gray-300">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
            <th className="py-2 pr-3">Турнір</th>
            <th className="py-2 pr-3">Тип</th>
            <th className="py-2 pr-3">Статус</th>
            <th className="py-2 pr-3">Почато</th>
            <th className="py-2 pr-3">Тривалість</th>
            <th className="py-2">Підсумок</th>
          </tr>
        </thead>
        <tbody>
          {syncRuns.data.map((syncRun) => (
            <tr key={syncRun.id} className="border-b border-gray-800/70 align-top">
              <td className="py-2 pr-3 font-semibold text-white">
                {syncRun.targetRef}
              </td>
              <td className="py-2 pr-3">
                {SCOPE_LABEL[syncRun.scope]}
                <span className="block text-gray-500">
                  {TRIGGER_LABEL[syncRun.trigger]}
                </span>
              </td>
              <td className="py-2 pr-3">
                <span
                  className={`rounded px-2 py-0.5 font-semibold ${STATUS_CLASS[syncRun.status]}`}
                >
                  {syncRun.status}
                </span>
              </td>
              <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                {formatStartedAt(syncRun.startedAt)}
              </td>
              <td className="py-2 pr-3 tabular-nums">{formatDuration(syncRun)}</td>
              <td className="py-2">
                {summarizeStats(syncRun.stats)}
                {syncRun.errorMessage && (
                  <span
                    className="block text-red-400 break-words"
                    title={syncRun.errorMessage}
                  >
                    {syncRun.errorMessage}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

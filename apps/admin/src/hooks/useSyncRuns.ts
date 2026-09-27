import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { SyncRunRow } from '@/lib/api/types';

const SYNC_RUNS_LIMIT = 20;
const SYNC_RUNS_REFETCH_MS = 5_000;
/**
 * Після натискання «Синк» журнал оновлюється стільки часу незалежно від статусів: 202 приходить
 * до першого `RUNNING`, а між турнірами бувають миті без `RUNNING`. 9 турнірів ≈ 4–5 хв.
 */
const SYNC_WATCH_MS = 10 * 60_000;
const SYNC_WATCH_KEY = ['admin', 'football', 'sync-watch-until'] as const;

export function syncRunsQueryOptions() {
  return queryOptions({
    queryKey: ['admin', 'football', 'sync-runs'] as const,
    queryFn: () =>
      apiGet<SyncRunRow[]>(`/football/sync-runs?limit=${SYNC_RUNS_LIMIT}`),
    staleTime: 10 * 1000,
  });
}

/** Синк запущено — стежити за журналом `SYNC_WATCH_MS`. */
export function watchSyncRuns(queryClient: QueryClient): Promise<void> {
  // Запис без спостерігачів кеш прибирає через gcTime (5 хв) — вікно обірвалось би раніше
  queryClient.setQueryDefaults(SYNC_WATCH_KEY, { gcTime: Infinity });
  queryClient.setQueryData(SYNC_WATCH_KEY, Date.now() + SYNC_WATCH_MS);
  return queryClient.invalidateQueries({
    queryKey: syncRunsQueryOptions().queryKey,
  });
}

/** Останні запуски синку (`GET /football/sync-runs`, ADMIN). */
export function useSyncRuns() {
  const queryClient = useQueryClient();
  return useQuery({
    ...syncRunsQueryOptions(),
    refetchInterval: (query) => {
      const hasRunningSync = query.state.data?.some(
        (syncRun) => syncRun.status === 'RUNNING',
      );
      const watchUntil = queryClient.getQueryData<number>(SYNC_WATCH_KEY) ?? 0;
      return hasRunningSync || Date.now() < watchUntil
        ? SYNC_RUNS_REFETCH_MS
        : false;
    },
  });
}

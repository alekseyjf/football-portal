'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { watchSyncRuns } from '@/hooks/useSyncRuns';
import { apiPost } from '@/lib/api/http';
import type { FootballSyncAccepted } from '@/lib/api/types';

export function FootballSyncButton() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => apiPost<FootballSyncAccepted>('/football/sync', {}),
    onSuccess: () => watchSyncRuns(queryClient),
  });

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="w-full rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:pointer-events-none px-4 py-3 text-sm font-semibold text-white transition-colors"
      >
        {mutation.isPending ? 'Запуск синку…' : 'Синк матчів і таблиці'}
      </button>
      <p className="text-xs text-gray-500 leading-relaxed">
        Усі <strong className="text-gray-400">активні</strong> турніри по черзі, у
        фоні (API відповідає <strong className="text-gray-400">202</strong> одразу;
        ~4 запити до football-data на турнір, ≈ 30 с кожен). Хід і результат —
        у журналі нижче.
      </p>
      {mutation.isSuccess && (
        <p className="text-xs text-green-400">
          Прийнято: {mutation.data.competitions.join(', ')}.
        </p>
      )}
      {mutation.isError && (
        <p className="text-xs text-red-400">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  );
}

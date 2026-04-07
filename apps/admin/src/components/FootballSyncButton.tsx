'use client';

import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/http';

type SyncAccepted = {
  status: 'accepted';
  message?: string;
  competitions: string[];
};

export function FootballSyncButton() {
  const mutation = useMutation({
    mutationFn: () => apiPost<SyncAccepted>('/football/sync', {}),
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
        API відповідає <strong className="text-gray-400">202</strong> одразу; імпорт
        іде <strong>у фоні</strong> (багато запитів + пауза ~6.5 с між ними). Прогрес
        і помилки — у <strong>терміналі Nest</strong>. Змагання:{' '}
        <code className="text-gray-400">FOOTBALL_COMPETITION_IDS</code> (дефолт{' '}
        <code className="text-gray-400">PL</code>).
      </p>
      {mutation.isSuccess && (
        <p className="text-xs text-green-400">
          Прийнято: {mutation.data.competitions.join(', ')}. Дані з’являться в БД
          після завершення фонового синку.
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

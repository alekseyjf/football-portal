import { useState } from 'react';
import type { MatchesInRange } from '@/lib/api/types';
import {
  isMatchesRefetchDue,
  KICKOFF_JITTER_MAX_MS,
  matchesRefetchInterval,
} from '@/lib/football/match-polling';

type MatchesQuery = {
  state: { data?: MatchesInRange; dataUpdatedAt: number };
};

/**
 * Опції `useQuery` для матчів дня (головна й `/matches`, D55): таймер перечитування і перевірка при поверненні у
 * вкладку з одним розкидом на вкладку (M1.6.4) — інакше кожен рендер брав би нове випадкове число.
 */
export function useMatchesPolling() {
  const [jitterMs] = useState(() => Math.random() * KICKOFF_JITTER_MAX_MS);
  return {
    refetchInterval: (query: MatchesQuery) =>
      matchesRefetchInterval(query.state.data?.matches ?? [], {
        now: new Date(),
        jitterMs,
      }),
    // Даних ще немає (помилка першого завантаження) — як за замовчуванням: перечитати
    refetchOnWindowFocus: (query: MatchesQuery) =>
      !query.state.data ||
      isMatchesRefetchDue(query.state.data.matches, {
        fetchedAt: new Date(query.state.dataUpdatedAt),
        now: new Date(),
        jitterMs,
      }),
  };
}

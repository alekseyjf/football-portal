/**
 * Групування матчів по номеру туру для відповіді API / сайдбару.
 * Імена змінних — повні (без одно-двобуквенних скорочень), щоб швидко читати логіку.
 */
export type MatchWithOptionalMatchday = { matchday: number | null };

export type MatchdayRoundGroup<MatchType extends MatchWithOptionalMatchday> = {
  matchday: number | null;
  matches: MatchType[];
};

/**
 * @param roundOrder — порядок турів з номером: asc = від меншого до більшого, desc — навпаки.
 */
export function groupMatchesByMatchday<MatchType extends MatchWithOptionalMatchday>(
  matches: MatchType[],
  roundOrder: 'asc' | 'desc',
): MatchdayRoundGroup<MatchType>[] {
  const matchesByMatchdayKey = new Map<number | null, MatchType[]>();

  for (const match of matches) {
    const matchdayKey: number | null = match.matchday ?? null;
    if (!matchesByMatchdayKey.has(matchdayKey)) {
      matchesByMatchdayKey.set(matchdayKey, []);
    }
    matchesByMatchdayKey.get(matchdayKey)!.push(match);
  }

  const entriesWithNumericMatchday: [number, MatchType[]][] = [
    ...matchesByMatchdayKey.entries(),
  ].filter((entry): entry is [number, MatchType[]] => entry[0] !== null);

  entriesWithNumericMatchday.sort((left, right) =>
    roundOrder === 'asc'
      ? left[0] - right[0]
      : right[0] - left[0],
  );

  const roundsOrdered: MatchdayRoundGroup<MatchType>[] =
    entriesWithNumericMatchday.map(([matchday, matchesInRound]) => ({
      matchday,
      matches: matchesInRound,
    }));

  const matchesWithoutMatchday = matchesByMatchdayKey.get(null);
  if (matchesWithoutMatchday?.length) {
    if (roundOrder === 'asc') {
      roundsOrdered.push({
        matchday: null,
        matches: matchesWithoutMatchday,
      });
    } else {
      roundsOrdered.unshift({
        matchday: null,
        matches: matchesWithoutMatchday,
      });
    }
  }

  return roundsOrdered;
}

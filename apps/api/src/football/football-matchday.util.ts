/**
 * Групування матчів у тури для відповіді API / сайдбару.
 * Імена змінних — повні (без одно-двобуквенних скорочень), щоб швидко читати логіку.
 */

/**
 * Стадії, що йдуть турами (і мають таблицю): тур = `matchday` у межах стадії. Решта — плей-оф:
 * тур = уся стадія, бо `matchday` там не «тур» (football-data: WC — `null`, EC — 4–7, F6).
 */
export const MATCHDAY_STAGES: readonly string[] = [
  'REGULAR_SEASON',
  'LEAGUE_STAGE',
  'GROUP_STAGE',
];

export type MatchForRound = {
  stage: string;
  matchday: number | null;
  kickoffAt: Date;
};

export type MatchRound<MatchType extends MatchForRound> = {
  stage: string;
  /** `null` — плей-оф (тур = стадія) або матч без туру */
  matchday: number | null;
  matches: MatchType[];
};

type RoundOrder = 'asc' | 'desc';

/** asc — від меншого туру, без туру — останнім; desc — навпаки. */
function compareMatchdays(
  leftMatchday: number | null,
  rightMatchday: number | null,
  roundOrder: RoundOrder,
): number {
  if (leftMatchday === rightMatchday) return 0;
  if (leftMatchday === null) return roundOrder === 'asc' ? 1 : -1;
  if (rightMatchday === null) return roundOrder === 'asc' ? -1 : 1;
  return roundOrder === 'asc'
    ? leftMatchday - rightMatchday
    : rightMatchday - leftMatchday;
}

/**
 * Тури: ключ — `(stage, matchday)`, у плей-оф — лише `stage` (обидва матчі двоматчевого раунду
 * в одному турі). Стадії — за часом: asc — від тієї, що починається раніше (за найранішим
 * матчем у списку), desc — від тієї, що скінчилась пізніше; усередині стадії — за `matchday`.
 * Ліга (одна стадія) — просто тури за номером, як і раніше.
 * Матчі всередині туру — у порядку вхідного списку.
 *
 * @param roundOrder — asc: найближчі тури першими (майбутні), desc: останні першими (минулі).
 */
export function groupMatchesIntoRounds<MatchType extends MatchForRound>(
  matches: MatchType[],
  roundOrder: RoundOrder,
): MatchRound<MatchType>[] {
  const roundsByKey = new Map<string, MatchRound<MatchType>>();
  const stageAnchorTimeByStage = new Map<string, number>();

  for (const match of matches) {
    const matchday = MATCHDAY_STAGES.includes(match.stage)
      ? match.matchday
      : null;
    const roundKey = `${match.stage}#${matchday ?? ''}`;
    let round = roundsByKey.get(roundKey);
    if (!round) {
      round = { stage: match.stage, matchday, matches: [] };
      roundsByKey.set(roundKey, round);
    }
    round.matches.push(match);

    const kickoffTime = match.kickoffAt.getTime();
    const stageAnchorTime = stageAnchorTimeByStage.get(match.stage);
    const isNewAnchor =
      stageAnchorTime === undefined ||
      (roundOrder === 'asc'
        ? kickoffTime < stageAnchorTime
        : kickoffTime > stageAnchorTime);
    if (isNewAnchor) stageAnchorTimeByStage.set(match.stage, kickoffTime);
  }

  const stageDirection = roundOrder === 'asc' ? 1 : -1;
  return [...roundsByKey.values()].sort(
    (leftRound, rightRound) =>
      stageDirection *
        (stageAnchorTimeByStage.get(leftRound.stage)! -
          stageAnchorTimeByStage.get(rightRound.stage)!) ||
      compareMatchdays(leftRound.matchday, rightRound.matchday, roundOrder),
  );
}

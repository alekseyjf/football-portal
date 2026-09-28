import { useTranslations } from 'next-intl';
import { MATCHDAY_STAGES } from '@/lib/api/types';

/** Стадії з перекладом у `football.stage.*` (ключі мають бути в en.json / ua.json). */
const TRANSLATED_STAGES = [
  'REGULAR_SEASON',
  'LEAGUE_STAGE',
  'GROUP_STAGE',
  'PLAYOFFS',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
] as const;

type TranslatedStage = (typeof TRANSLATED_STAGES)[number];

function isTranslatedStage(stage: string): stage is TranslatedStage {
  return (TRANSLATED_STAGES as readonly string[]).includes(stage);
}

/** `QUALIFICATION_ROUND_1` → «Qualification round 1»: нова стадія провайдера не ламає UI (D18). */
function humanizeProviderCode(code: string): string {
  const words = code.toLowerCase().split('_').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Підписи стадій і груп турніру: «Ліга-фаза», «1/8 фіналу», «Група A». */
export function useFootballStageLabels() {
  const tFootball = useTranslations('football');

  const stageLabel = (stage: string): string =>
    isTranslatedStage(stage)
      ? tFootball(`stage.${stage}`)
      : humanizeProviderCode(stage);

  /** `GROUP_A` → «Група A» (маппер пише лише `GROUP_*`). */
  const groupLabel = (groupName: string): string => {
    const groupLetter = /^GROUP_(\w+)$/.exec(groupName)?.[1];
    return groupLetter
      ? tFootball('groupLabel', { group: groupLetter })
      : humanizeProviderCode(groupName);
  };

  /**
   * Тур кубка: ліга-фаза / групи — «Ліга-фаза · Тур 2»; плей-оф — лише стадія («Фінал»):
   * його `matchday` — не тур (WC — `null`, EC — 4–7).
   */
  const stageRoundLabel = (stage: string, matchday: number | null): string =>
    matchday != null && MATCHDAY_STAGES.includes(stage)
      ? tFootball('stageRoundLabel', {
          stage: stageLabel(stage),
          n: String(matchday),
        })
      : stageLabel(stage);

  return { stageLabel, groupLabel, stageRoundLabel };
}

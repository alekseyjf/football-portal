import { POST_RELATION_IDS_MAX } from '@football-portal/validation';
import type { AdminLeague, CompetitionRef } from '@/lib/api/types';

/**
 * Зв'язки новини у формі — теги, клуби, турніри (D51): id у сталому порядку (за id). Порядку зв'язків БД не зберігає
 * (`PostTag` — лише пара id), тож вибране — набір: той самий набір дає той самий масив, і «є зміни» (сторож, Save)
 * рахується як для набору. Чипи впорядковує той, хто їх показує, — за назвою.
 */
export type RelationIds = readonly string[];

/** id сутностей → вибране у формі. */
export function toRelationIds(items: readonly { id: string }[]): string[] {
  // Рядки id — у порядку кодів символів: той самий у будь-якому браузері й мові
  return [...new Set(items.map((item) => item.id))].sort();
}

/** Більше вибрати не можна: межа API — `POST_RELATION_IDS_MAX` кожного виду. */
export function isRelationLimitReached(ids: RelationIds): boolean {
  return ids.length >= POST_RELATION_IDS_MAX;
}

/** Вибране з ще одним id; уже вибраний чи межу досягнуто — без змін. */
export function withRelationId(ids: RelationIds, id: string): string[] {
  if (ids.includes(id) || isRelationLimitReached(ids)) return [...ids];
  return [...ids, id].sort();
}

export function withoutRelationId(ids: RelationIds, id: string): string[] {
  return ids.filter((selectedId) => selectedId !== id);
}

/** Той самий набір — порядок не важить. */
export function isSameRelationSet(first: RelationIds, second: RelationIds): boolean {
  if (first.length !== second.length) return false;
  const secondIds = new Set(second);
  return first.every((id) => secondIds.has(id));
}

/**
 * Підказка турнірів (D46, D51): турніри «у грі» клубів, вибраних у формі, яких ще немає серед вибраних, — у порядку
 * редакції (`leagues`, як і чекбокси), без повторів. Автозапису немає: редактор додає кліком.
 */
export function suggestCompetitions(
  leagues: readonly AdminLeague[],
  clubs: readonly { competitions: readonly CompetitionRef[] }[],
  selectedIds: RelationIds,
): AdminLeague[] {
  const playedIds = new Set(clubs.flatMap((club) => club.competitions.map((competition) => competition.id)));
  return leagues.filter((league) => playedIds.has(league.id) && !selectedIds.includes(league.id));
}

/**
 * 400 `UNKNOWN_TAG` (D51): тег видалили, поки форма була відкрита. `existing` — свіжий список: вибрані, яких у ньому
 * немає, зникли.
 */
export function splitVanishedIds(
  selectedIds: RelationIds,
  existing: readonly { id: string }[],
): { kept: string[]; vanished: string[] } {
  const existingIds = new Set(existing.map((item) => item.id));
  return {
    kept: selectedIds.filter((id) => existingIds.has(id)),
    vanished: selectedIds.filter((id) => !existingIds.has(id)),
  };
}

import type { Prisma } from '@prisma/client';
import type { FdStanding, FdStandingRow } from './integration/football.mapper';

export function pickStandingsTableRows(
  standingGroups: FdStanding[],
): {
  rows: FdStandingRow[];
  pickedType: string | null;
  usedFallback: boolean;
} {
  let tableRows = standingGroups.find((group) => group.type === 'TOTAL')?.table ?? [];
  let pickedType: string | null = tableRows.length ? 'TOTAL' : null;
  let usedFallback = false;

  if (!tableRows.length) {
    const firstNonEmptyGroup = standingGroups.find(
      (group) => (group.table?.length ?? 0) > 0,
    );
    if (firstNonEmptyGroup?.table?.length) {
      tableRows = firstNonEmptyGroup.table;
      pickedType = firstNonEmptyGroup.type ?? null;
      usedFallback = true;
    }
  }

  return { rows: tableRows, pickedType, usedFallback };
}

export function buildLeagueTableCreateRows(
  leagueId: string,
  apiStandingRows: FdStandingRow[],
  clubIdByExternalTeamId: Map<number, string>,
): { rows: Prisma.LeagueTableCreateManyInput[]; skippedNoClub: number } {
  const prismaRows: Prisma.LeagueTableCreateManyInput[] = [];
  let skippedNoClub = 0;

  for (const apiRow of apiStandingRows) {
    const internalClubId = clubIdByExternalTeamId.get(apiRow.team.id);
    if (!internalClubId) {
      skippedNoClub += 1;
      continue;
    }
    prismaRows.push({
      leagueId,
      clubId: internalClubId,
      position: apiRow.position,
      played: apiRow.playedGames ?? 0,
      won: apiRow.won ?? 0,
      drawn: apiRow.draw ?? 0,
      lost: apiRow.lost ?? 0,
      points: apiRow.points ?? 0,
      goalsFor: apiRow.goalsFor ?? 0,
      goalsAgainst: apiRow.goalsAgainst ?? 0,
      goalDiff: apiRow.goalDifference ?? 0,
    });
  }

  return { rows: prismaRows, skippedNoClub };
}

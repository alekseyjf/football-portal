import { StandingType } from '@prisma/client';

/** Стадії, чия таблиця — «головна» турніру: ліга, ліга-фаза кубка, групи. */
const PRIMARY_STAGE_ORDER = ['REGULAR_SEASON', 'LEAGUE_STAGE', 'GROUP_STAGE'];

type StandingTableKey = {
  stage: string;
  groupName: string | null;
  type: StandingType;
};

function stageRank(stage: string): number {
  const rank = PRIMARY_STAGE_ORDER.indexOf(stage);
  return rank === -1 ? PRIMARY_STAGE_ORDER.length : rank;
}

/**
 * Таблиця для дашборду (P5-16): `TOTAL` першої стадії з `PRIMARY_STAGE_ORDER`, у ній —
 * перша група (без групи — першою). LEAGUE → таблиця ліги; CUP → ліга-фаза або група A.
 */
export function pickPrimaryStandingTable<Table extends StandingTableKey>(
  tables: Table[],
): Table | null {
  const totalTables = tables.filter(
    (table) => table.type === StandingType.TOTAL,
  );
  const candidateTables = totalTables.length > 0 ? totalTables : tables;
  return (
    [...candidateTables].sort(
      (leftTable, rightTable) =>
        stageRank(leftTable.stage) - stageRank(rightTable.stage) ||
        (leftTable.groupName ?? '').localeCompare(rightTable.groupName ?? ''),
    )[0] ?? null
  );
}

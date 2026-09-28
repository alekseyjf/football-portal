import { StandingType } from '@prisma/client';
import type { StandingRowRecord } from '../persistence/football.repository';
import { toPublicStandingTables } from './football-response';
import { seasonLabelFromParam } from './football-season-param';
import { pickPrimaryStandingTable } from './football-standings.util';

function standingRow(
  stage: string,
  groupName: string,
  type: StandingType,
  position: number,
): StandingRowRecord {
  return {
    stage,
    groupName,
    type,
    position,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    form: null,
    club: {
      id: `club-${stage}-${groupName}-${position}`,
      slug: 'club',
      name: 'Club',
      shortName: null,
      tla: null,
      crestUrl: null,
    },
  };
}

describe('pickPrimaryStandingTable (P5-16)', () => {
  const table = (
    stage: string,
    groupName: string | null,
    type: StandingType,
  ) => ({
    stage,
    groupName,
    type,
  });

  it('ліга — REGULAR_SEASON TOTAL, а не HOME / AWAY', () => {
    expect(
      pickPrimaryStandingTable([
        table('REGULAR_SEASON', null, StandingType.HOME),
        table('REGULAR_SEASON', null, StandingType.TOTAL),
        table('REGULAR_SEASON', null, StandingType.AWAY),
      ]),
    ).toEqual(table('REGULAR_SEASON', null, StandingType.TOTAL));
  });

  it('кубок — ліга-фаза перед плей-оф; групи — перша за назвою', () => {
    expect(
      pickPrimaryStandingTable([
        table('PLAYOFFS', null, StandingType.TOTAL),
        table('LEAGUE_STAGE', null, StandingType.TOTAL),
      ])?.stage,
    ).toBe('LEAGUE_STAGE');
    expect(
      pickPrimaryStandingTable([
        table('GROUP_STAGE', 'GROUP_B', StandingType.TOTAL),
        table('GROUP_STAGE', 'GROUP_A', StandingType.TOTAL),
      ])?.groupName,
    ).toBe('GROUP_A');
    expect(pickPrimaryStandingTable([])).toBeNull();
  });
});

describe('toPublicStandingTables', () => {
  it('рядки → таблиці за (stage, groupName, type); "" → null', () => {
    const tables = toPublicStandingTables([
      standingRow('GROUP_STAGE', 'GROUP_A', StandingType.TOTAL, 1),
      standingRow('GROUP_STAGE', 'GROUP_A', StandingType.TOTAL, 2),
      standingRow('GROUP_STAGE', 'GROUP_B', StandingType.TOTAL, 1),
      standingRow('REGULAR_SEASON', '', StandingType.TOTAL, 1),
    ]);
    expect(
      tables.map((standingTable) => [
        standingTable.stage,
        standingTable.groupName,
        standingTable.rows.map((row) => row.position),
      ]),
    ).toEqual([
      ['GROUP_STAGE', 'GROUP_A', [1, 2]],
      ['GROUP_STAGE', 'GROUP_B', [1]],
      ['REGULAR_SEASON', null, [1]],
    ]);
    expect(Object.keys(tables[0].rows[0])).not.toContain('stage');
  });
});

describe('seasonLabelFromParam', () => {
  it('2025-26 → 2025/26; 2026 → 2026', () => {
    expect(seasonLabelFromParam('2025-26')).toBe('2025/26');
    expect(seasonLabelFromParam('2026')).toBe('2026');
  });
});

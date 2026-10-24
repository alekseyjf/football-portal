import { POST_RELATION_IDS_MAX } from '@football-portal/validation';
import { describe, expect, it } from 'vitest';
import type { AdminLeague } from '@/lib/api/types';
import {
  isRelationLimitReached,
  isSameRelationSet,
  splitVanishedIds,
  suggestCompetitions,
  toRelationIds,
  withoutRelationId,
  withRelationId,
} from './postRelations';

function league(slug: string, type: AdminLeague['type'] = 'LEAGUE', isActive = true): AdminLeague {
  return { id: `id-${slug}`, slug, name: slug, type, isActive };
}

const PL = league('PL');
const PD = league('PD');
const CL = league('CL', 'CUP');
const WC = league('WC', 'CUP', false);
const LEAGUES = [PL, CL, PD, WC];
const ref = ({ id, slug, name }: AdminLeague) => ({ id, slug, name });

describe('вибране у формі — набір id', () => {
  it('той самий набір — той самий масив, у якому б порядку не вибирали: «є зміни» рахується як для набору', () => {
    const pickedOneWay = withRelationId(withRelationId([], 'tag-b'), 'tag-a');
    const pickedOtherWay = withRelationId(withRelationId([], 'tag-a'), 'tag-b');
    expect(pickedOneWay).toEqual(pickedOtherWay);
    expect(toRelationIds([{ id: 'tag-b' }, { id: 'tag-a' }])).toEqual(pickedOneWay);
    // Прибрали й вибрали знову — як збережене
    expect(withRelationId(withoutRelationId(pickedOneWay, 'tag-a'), 'tag-a')).toEqual(pickedOneWay);
  });

  it('вдруге той самий не додається; прибрати — лише його', () => {
    expect(withRelationId(['tag-a'], 'tag-a')).toEqual(['tag-a']);
    expect(withoutRelationId(['tag-a', 'tag-b'], 'tag-a')).toEqual(['tag-b']);
  });

  it(`межа API — ${POST_RELATION_IDS_MAX} кожного виду: далі вибір не додає`, () => {
    const fullIds = Array.from({ length: POST_RELATION_IDS_MAX }, (_, index) => `tag-${String(index).padStart(2, '0')}`);
    expect(isRelationLimitReached(fullIds.slice(1))).toBe(false);
    expect(isRelationLimitReached(fullIds)).toBe(true);
    expect(withRelationId(fullIds, 'tag-extra')).toEqual(fullIds);
  });

  it('порівняння — як набору: порядок не важить, інший склад — зміна', () => {
    expect(isSameRelationSet(['tag-a', 'tag-b'], ['tag-b', 'tag-a'])).toBe(true);
    expect(isSameRelationSet(['tag-a', 'tag-b'], ['tag-a', 'tag-c'])).toBe(false);
    expect(isSameRelationSet(['tag-a'], ['tag-a', 'tag-b'])).toBe(false);
  });
});

describe('suggestCompetitions — підказка турнірів вибраних клубів (D46)', () => {
  it('турніри «у грі» клубів — у порядку редакції, без повторів і без уже вибраних', () => {
    const arsenal = { competitions: [ref(CL), ref(PL)] };
    const chelsea = { competitions: [ref(PL)] };
    expect(suggestCompetitions(LEAGUES, [arsenal, chelsea], []).map((found) => found.slug)).toEqual(['PL', 'CL']);
    expect(suggestCompetitions(LEAGUES, [arsenal, chelsea], [PL.id]).map((found) => found.slug)).toEqual(['CL']);
  });

  it('клуб без турнірів «у грі» нічого не підказує', () => {
    expect(suggestCompetitions(LEAGUES, [{ competitions: [] }], [])).toEqual([]);
  });
});

describe('splitVanishedIds — UNKNOWN_TAG: які з вибраних тегів видалили (D51)', () => {
  it('вибраних, яких немає у свіжому списку, — зникли; решта лишається', () => {
    expect(splitVanishedIds(['tag-a', 'tag-b', 'tag-c'], [{ id: 'tag-a' }, { id: 'tag-c' }, { id: 'tag-d' }])).toEqual({
      kept: ['tag-a', 'tag-c'],
      vanished: ['tag-b'],
    });
  });
});

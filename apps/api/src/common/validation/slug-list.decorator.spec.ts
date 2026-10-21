import { validate } from 'class-validator';
import { SLUG_PATTERN } from '../slug';
import { IsSlugList } from './slug-list.decorator';

const MAX_VALUES = 3;
const MAX_LENGTH = 10;

class FilterProbe {
  @IsSlugList({
    pattern: SLUG_PATTERN,
    maxLength: MAX_LENGTH,
    maxValues: MAX_VALUES,
  })
  tags!: unknown;
}

async function isValidList(tags: unknown): Promise<boolean> {
  const probe = new FilterProbe();
  probe.tags = tags;
  return (await validate(probe)).length === 0;
}

describe('IsSlugList', () => {
  it(`одне значення і рівно ${MAX_VALUES} — можна, ${MAX_VALUES + 1} — ні`, async () => {
    expect(await isValidList('transfers')).toBe(true);
    expect(await isValidList('a,b,c')).toBe(true);
    expect(await isValidList('a,b,c,d')).toBe(false);
  });

  it.each(['', 'a,,b', 'a,', ',a'])(
    'порожнє значення %j — ні',
    async (tags) => {
      expect(await isValidList(tags)).toBe(false);
    },
  );

  it(`значення не за форматом чи довше за ${MAX_LENGTH} — ні; рівно ${MAX_LENGTH} — можна`, async () => {
    expect(await isValidList('a'.repeat(MAX_LENGTH))).toBe(true);
    for (const tags of [
      'a'.repeat(MAX_LENGTH + 1),
      'transfers,Injuries',
      'transfers, injuries',
      'transfers;injuries',
    ]) {
      expect(await isValidList(tags)).toBe(false);
    }
  });

  it('повтор параметра (`?tags=a&tags=b` — масив) — ні', async () => {
    expect(await isValidList(['a', 'b'])).toBe(false);
  });
});

import { containsIgnoringCase } from './prisma-text-search';

describe('containsIgnoringCase', () => {
  it.each([
    ['100%', '100\\%'],
    ['a_b', 'a\\_b'],
    ['back\\slash', 'back\\\\slash'],
    ['%_\\', '\\%\\_\\\\'],
  ])('%j — символи шаблону LIKE шукаються як текст: %j', (search, pattern) => {
    expect(containsIgnoringCase(search).contains).toBe(pattern);
  });

  it('звичайний текст, і кирилиця, — без змін; регістр ігнорує БД (`mode: insensitive`)', () => {
    expect(containsIgnoringCase("Динамо — Шахтар: 2:1 'дербі'")).toEqual({
      contains: "Динамо — Шахтар: 2:1 'дербі'",
      mode: 'insensitive',
    });
  });
});

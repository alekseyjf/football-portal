import { sitemapMonthRange, sitemapPostLimit } from './post-sitemap';

describe('sitemapMonthRange — місяць publishedAt в UTC', () => {
  it('жовтень — з 1 жовтня 00:00 UTC до 1 листопада, не включно', () => {
    expect(sitemapMonthRange('2026-10')).toEqual({
      start: new Date('2026-10-01T00:00:00.000Z'),
      end: new Date('2026-11-01T00:00:00.000Z'),
    });
  });

  it('грудень — до 1 січня наступного року', () => {
    expect(sitemapMonthRange('2026-12')).toEqual({
      start: new Date('2026-12-01T00:00:00.000Z'),
      end: new Date('2027-01-01T00:00:00.000Z'),
    });
  });
});

describe('sitemapPostLimit — новин у файлі', () => {
  it('межа адрес ділиться на кількість мов: кожна новина — адреса кожною', () => {
    expect(sitemapPostLimit(50_000, 2)).toBe(25_000);
    expect(sitemapPostLimit(1000, 3)).toBe(333);
  });
});

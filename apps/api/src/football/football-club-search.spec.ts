import {
  clubSearchWhere,
  rankClubSearchResults,
  type ClubSearchFields,
} from './football-club-search';

const RESULTS_LIMIT = 20;

function club(
  name: string,
  slug: string,
  shortName: string | null = null,
  tla: string | null = null,
): ClubSearchFields {
  return { name, slug, shortName, tla };
}

function containsInsensitive(text: string) {
  return { contains: text, mode: 'insensitive' };
}

describe('clubSearchWhere (D48)', () => {
  it('назва, коротка назва, код — підрядок без урахування регістру; адреса — запит у формі адреси', () => {
    expect(clubSearchWhere('Atlético Madrid')).toEqual({
      OR: [
        { name: containsInsensitive('Atlético Madrid') },
        { shortName: containsInsensitive('Atlético Madrid') },
        { tla: containsInsensitive('Atlético Madrid') },
        { slug: { contains: 'atletico-madrid' } },
      ],
    });
  });

  it('запит без латиниці й цифр (кирилиця) адресою не шукає: `slugify` його відкидає', () => {
    expect(clubSearchWhere('Динамо')).toEqual({
      OR: [
        { name: containsInsensitive('Динамо') },
        { shortName: containsInsensitive('Динамо') },
        { tla: containsInsensitive('Динамо') },
      ],
    });
  });
});

describe('rankClubSearchResults (D48)', () => {
  const arsenal = club('Arsenal FC', 'arsenal', 'Arsenal', 'ARS');
  const astonVilla = club('Aston Villa FC', 'aston-villa-fc', 'Aston Villa');
  const chelsea = club('Chelsea FC', 'chelsea', 'Chelsea', 'CHE');
  const barcelona = club('FC Barcelona', 'fc-barcelona', 'Barça', 'FCB');
  const bayern = club(
    'FC Bayern München',
    'fc-bayern-munchen',
    'Bayern',
    'FCB',
  );
  const malaga = club('Málaga CF', 'malaga-cf', 'Málaga', 'MAL');

  it('спершу ті, чия назва починається з запиту (без урахування регістру), далі — за абеткою', () => {
    const candidates = [chelsea, bayern, arsenal, barcelona];
    const ranked = [barcelona, bayern, arsenal, chelsea];
    expect(rankClubSearchResults(candidates, 'fc', RESULTS_LIMIT)).toEqual(
      ranked,
    );
    expect(rankClubSearchResults(candidates, 'FC', RESULTS_LIMIT)).toEqual(
      ranked,
    );
  });

  it.each([
    ['коротка назва', 'bar', barcelona],
    ['код', 'fcb', bayern],
    ['адреса — запит без діакритики', 'malaga', malaga],
  ])(
    'початок будь-якого з полів піднімає клуб над абеткою: %s',
    (_field, search, prefixMatch) => {
      expect(
        rankClubSearchResults([astonVilla, prefixMatch], search, RESULTS_LIMIT),
      ).toEqual([prefixMatch, astonVilla]);
    },
  );

  it('спершу ранжує всі збіги, потім бере перші `limit`: клуб, що починається з запиту, не губиться за абеткою', () => {
    expect(
      rankClubSearchResults([arsenal, chelsea, barcelona], 'fc', 2),
    ).toEqual([barcelona, arsenal]);
  });
});

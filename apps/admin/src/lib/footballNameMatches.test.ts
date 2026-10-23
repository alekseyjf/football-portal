import { describe, expect, it } from 'vitest';
import { findFootballNameMatches } from './footballNameMatches';

const COMPETITIONS = [
  { slug: 'PL', name: 'Premier League' },
  { slug: 'CL', name: 'UEFA Champions League' },
  { slug: 'WC', name: 'FIFA World Cup' },
];
const CLUBS = [
  { name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS' },
  { name: 'Manchester United FC', shortName: 'Man United', tla: 'MUN' },
  { name: 'Paris Saint-Germain FC', shortName: 'PSG', tla: 'PSG' },
  { name: 'FC Barcelona', shortName: 'Barça', tla: 'FCB' },
  { name: 'Club Atlético de Madrid', shortName: 'Atleti', tla: 'ATL' },
];

function matchedNames(tagName: string) {
  const matches = findFootballNameMatches(tagName, { competitions: COMPETITIONS, clubs: CLUBS });
  return {
    competitions: matches.competitions.map((competition) => competition.name),
    clubs: matches.clubs.map((club) => club.name),
  };
}

describe('findFootballNameMatches — назва тегу як у клубу чи турніру (D51)', () => {
  it('цілими словами в повній назві клубу, без регістру: «arsenal» → Arsenal FC, а «Arse» — ні', () => {
    expect(matchedNames('arsenal').clubs).toEqual(['Arsenal FC']);
    expect(matchedNames('Arse').clubs).toEqual([]);
  });

  it('коротка назва чи код клубу: «Man United», «PSG»', () => {
    expect(matchedNames('Man United').clubs).toEqual(['Manchester United FC']);
    expect(matchedNames('psg').clubs).toEqual(['Paris Saint-Germain FC']);
  });

  it('діакритика й розділові знаки не важать: «Barca» = «Barça», «Atletico» — слово з «Atlético»', () => {
    expect(matchedNames('Barca').clubs).toEqual(['FC Barcelona']);
    expect(matchedNames('Atletico').clubs).toEqual(['Club Atlético de Madrid']);
    expect(matchedNames('Man. United!').clubs).toEqual(['Manchester United FC']);
  });

  it('турнір — цілими словами в назві чи за кодом: «Champions League», «World Cup», «PL»', () => {
    expect(matchedNames('Champions League').competitions).toEqual(['UEFA Champions League']);
    expect(matchedNames('world cup').competitions).toEqual(['FIFA World Cup']);
    expect(matchedNames('PL').competitions).toEqual(['Premier League']);
  });

  it('тема, у назві якої є клуб, — не збіг: «Arsenal transfers» — це тег «Transfers» і клуб Arsenal', () => {
    expect(matchedNames('Arsenal transfers')).toEqual({ competitions: [], clubs: [] });
    expect(matchedNames('Transfers')).toEqual({ competitions: [], clubs: [] });
  });

  it('назва без латиниці — збігів немає: назви клубів і турнірів латиницею (D42)', () => {
    expect(matchedNames('Арсенал')).toEqual({ competitions: [], clubs: [] });
  });
});

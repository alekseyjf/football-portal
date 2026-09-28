import { pickClubSlug, slugifyClubName } from './football-club-slug';
import { payloadHashOf } from './football-payload-hash';

describe('payloadHashOf (P5-6)', () => {
  it('не залежить від порядку ключів; Date — за значенням', () => {
    const kickoffAt = new Date('2026-08-21T19:00:00Z');
    expect(
      payloadHashOf({
        status: 'FINISHED',
        score: { home: 3, away: 0 },
        kickoffAt,
      }),
    ).toBe(
      payloadHashOf({
        kickoffAt: new Date(kickoffAt.getTime()),
        score: { away: 0, home: 3 },
        status: 'FINISHED',
      }),
    );
  });

  it('зміна будь-якого поля — інший хеш; null ≠ відсутнє ≠ 0', () => {
    const base = payloadHashOf({ homeScore: 1, minute: null });
    expect(payloadHashOf({ homeScore: 2, minute: null })).not.toBe(base);
    expect(payloadHashOf({ homeScore: 1, minute: 0 })).not.toBe(base);
    expect(payloadHashOf({ homeScore: 1 })).not.toBe(base);
    expect(payloadHashOf({ homeScore: 1, minute: undefined })).toBe(
      payloadHashOf({ homeScore: 1 }),
    );
  });
});

describe('pickClubSlug (P5-5)', () => {
  it('slug без id провайдера; діакритика прибирається', () => {
    expect(slugifyClubName('Atlético de Madrid')).toBe('atletico-de-madrid');
    expect(slugifyClubName('Curaçao')).toBe('curacao');
    expect(slugifyClubName('  ---  ')).toBe('club');
    expect(pickClubSlug('Arsenal FC', 'ENG', new Set())).toBe('arsenal-fc');
  });

  it('літери, які NFD не розкладає, транслітеруються, а не зникають', () => {
    expect(slugifyClubName('FK Bodø/Glimt')).toBe('fk-bodo-glimt');
    expect(slugifyClubName('Brøndby IF')).toBe('brondby-if');
    expect(slugifyClubName('Śląsk Wrocław')).toBe('slask-wroclaw');
    expect(slugifyClubName('Kasımpaşa SK')).toBe('kasimpasa-sk');
    expect(slugifyClubName('İstanbul Başakşehir')).toBe('istanbul-basaksehir');
    expect(slugifyClubName('Fußball-Club Æsir')).toBe('fussball-club-aesir');
    expect(slugifyClubName('NK Osijek Đakovo')).toBe('nk-osijek-dakovo');
  });

  it('зайнятий → з кодом країни → з номером', () => {
    const takenSlugs = new Set(['barcelona']);
    expect(pickClubSlug('Barcelona', 'ECU', takenSlugs)).toBe('barcelona-ecu');
    takenSlugs.add('barcelona-ecu');
    expect(pickClubSlug('Barcelona', 'ECU', takenSlugs)).toBe('barcelona-2');
    expect(pickClubSlug('Barcelona', null, new Set(['barcelona']))).toBe(
      'barcelona-2',
    );
  });
});

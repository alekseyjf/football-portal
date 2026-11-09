import {
  findCrossSiteViolation,
  type MutationOrigin,
} from './cross-site-request';

const SITE = 'https://site.example';
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  SITE,
  'https://admin.example',
]);

/** Мутація зі сторінки сайту через його проксі — так її бачить API */
const SITE_MUTATION: MutationOrigin = {
  method: 'POST',
  origin: SITE,
  secFetchSite: 'same-origin',
  contentType: 'application/json',
  hasBody: true,
};

function violationCode(overrides: Partial<MutationOrigin>): string | null {
  return (
    findCrossSiteViolation({ ...SITE_MUTATION, ...overrides }, ALLOWED_ORIGINS)
      ?.code ?? null
  );
}

describe('findCrossSiteViolation — CSRF (D60)', () => {
  it('мутація сайту, адмінки, Swagger UI самого API і без браузера (curl, тести) — пропускає', () => {
    expect(violationCode({})).toBeNull();
    expect(
      violationCode({
        origin: 'https://admin.example',
        secFetchSite: undefined,
      }),
    ).toBeNull();
    // Swagger UI на домені API: його origin не в списку сайту, але запит same-origin
    expect(violationCode({ origin: 'https://api.example' })).toBeNull();
    expect(
      violationCode({ origin: undefined, secFetchSite: undefined }),
    ).toBeNull();
  });

  it('чужий сайт: cross-site або Origin поза списком (старий браузер без Fetch Metadata) — 403', () => {
    for (const overrides of [
      { secFetchSite: 'cross-site' },
      // Origin зі списку не рятує: адмінка й сайт на *.vercel.app — різні сайти, і шлють кожна у свій проксі
      { origin: 'https://admin.example', secFetchSite: 'cross-site' },
      { origin: 'https://evil.example', secFetchSite: undefined },
      { origin: 'https://evil.example', secFetchSite: 'same-site' },
      { origin: 'null', secFetchSite: undefined },
    ]) {
      expect(violationCode(overrides)).toBe('CROSS_SITE_REQUEST_FORBIDDEN');
    }
  });

  it('тіло мутації — лише JSON (415): форма й text/plain — ні; без тіла (refresh, logout) — без типу', () => {
    for (const contentType of [
      'application/x-www-form-urlencoded',
      'multipart/form-data; boundary=x',
      'text/plain;charset=UTF-8',
      undefined,
    ]) {
      expect(violationCode({ contentType })).toBe('UNSUPPORTED_MEDIA_TYPE');
    }
    expect(
      violationCode({ contentType: 'Application/JSON; charset=utf-8' }),
    ).toBeNull();
    expect(
      violationCode({ contentType: undefined, hasBody: false }),
    ).toBeNull();
    // Порожня форма теж шле Content-Type — її відхиляємо
    expect(
      violationCode({
        contentType: 'application/x-www-form-urlencoded',
        hasBody: false,
      }),
    ).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('читання не перевіряє: GET з чужого сайту нічого не змінює', () => {
    expect(
      violationCode({
        method: 'GET',
        secFetchSite: 'cross-site',
        contentType: undefined,
        hasBody: false,
      }),
    ).toBeNull();
  });
});

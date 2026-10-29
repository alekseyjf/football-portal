import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/http';
import { isHomeApiDown } from './home-blocks';

const ok: PromiseSettledResult<unknown> = { status: 'fulfilled', value: {} };

function failed(reason: unknown): PromiseSettledResult<unknown> {
  return { status: 'rejected', reason };
}

const networkError = failed(new TypeError('fetch failed'));
const serverError = failed(new ApiError(503, 'API error: 503', null));
const leagueNotFound = failed(new ApiError(404, 'LEAGUE_NOT_FOUND', null));

describe('Головна: коли вся сторінка — error.tsx, а коли — помилка в одному блоці (D55)', () => {
  it('API недоступне для всіх запитів (мережа, 5xx) — сторінка з помилкою', () => {
    expect(isHomeApiDown([networkError, serverError])).toBe(true);
    expect(isHomeApiDown([networkError, networkError, networkError])).toBe(
      true,
    );
  });

  it('хоч один блок завантажився — сторінка, а помилки — у блоках', () => {
    expect(isHomeApiDown([networkError, ok, serverError])).toBe(false);
  });

  it('4xx — відповідь API, а не збій: ліги з ?league= немає, а решта впала — не error.tsx', () => {
    expect(isHomeApiDown([networkError, leagueNotFound])).toBe(false);
  });

  it('запитів не було — збою теж', () => {
    expect(isHomeApiDown([])).toBe(false);
  });
});

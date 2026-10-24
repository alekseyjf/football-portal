import { ADMIN_CLUBS_SEARCH_MAX_LENGTH } from '@football-portal/validation';
import { describe, expect, it } from 'vitest';
import { isClubSearchText } from './useAdminClubSearch';

describe('isClubSearchText — який пошук клубів надсилати (D48)', () => {
  it('2–100 символів після trim — інакше API відповів би 400', () => {
    expect(isClubSearchText(' ar ')).toBe(true);
    expect(isClubSearchText(' a ')).toBe(false);
    expect(isClubSearchText('a'.repeat(ADMIN_CLUBS_SEARCH_MAX_LENGTH + 1))).toBe(false);
  });

  it('без латиниці й цифр — ні: назви клубів англійською (D42), кирилицею нічого не знайдеться', () => {
    expect(isClubSearchText('Динамо')).toBe(false);
    expect(isClubSearchText('Динамо Kyiv')).toBe(true);
    expect(isClubSearchText('04')).toBe(true);
  });
});

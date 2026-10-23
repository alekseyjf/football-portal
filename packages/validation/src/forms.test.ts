import { describe, expect, it } from 'vitest';
import { tagFormSchema, tagNamesFormSchema } from './forms';
import { TAG_NAME_MAX_LENGTH, TAG_SLUG_MAX_LENGTH } from './index';

const VALID_TAG = { nameEn: 'Transfers', nameUk: 'Трансфери', slug: '' };

/** Поля з помилками й перше повідомлення кожного — як їх покаже форма. */
function fieldErrors(values: unknown): Record<string, string> {
  const result = tagFormSchema.safeParse(values);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[issue.path.join('.')] ??= issue.message;
  return errors;
}

describe('форма тегу (D45, D51)', () => {
  it('обидві назви обов’язкові: порожня чи з самих пробілів — помилка', () => {
    for (const emptyName of ['', '   ']) {
      expect(fieldErrors({ ...VALID_TAG, nameEn: emptyName })).toHaveProperty('nameEn');
      expect(fieldErrors({ ...VALID_TAG, nameUk: emptyName })).toHaveProperty('nameUk');
    }
  });

  it('назва кожною мовою — 2–50 символів після trim, як в API', () => {
    expect(fieldErrors({ ...VALID_TAG, nameEn: ' a ' })).toEqual({
      nameEn: 'Name must be at least 2 characters',
    });
    expect(fieldErrors({ ...VALID_TAG, nameUk: 'Т' })).toEqual({ nameUk: 'Name must be at least 2 characters' });
    expect(fieldErrors({ ...VALID_TAG, nameEn: 'x'.repeat(TAG_NAME_MAX_LENGTH) })).toEqual({});
    expect(fieldErrors({ ...VALID_TAG, nameUk: 'ж'.repeat(TAG_NAME_MAX_LENGTH + 1) })).toEqual({
      nameUk: 'Name must be at most 50 characters',
    });
  });

  it('після перевірки — без пробілів по краях: так назви збереже API', () => {
    expect(tagFormSchema.parse({ nameEn: '  Transfer window ', nameUk: ' Трансферне вікно', slug: ' ' })).toEqual({
      nameEn: 'Transfer window',
      nameUk: 'Трансферне вікно',
      slug: '',
    });
  });

  it('адреса — латиниця в нижньому регістрі, цифри й одинарні дефіси, до 50', () => {
    expect(fieldErrors({ ...VALID_TAG, slug: 'transfer-window-2026' })).toEqual({});
    for (const slug of ['Transfers', 'transfer--window', '-transfers', 'трансфери', 'transfer_window']) {
      expect(fieldErrors({ ...VALID_TAG, slug })).toHaveProperty('slug');
    }
    expect(fieldErrors({ ...VALID_TAG, slug: 'x'.repeat(TAG_SLUG_MAX_LENGTH + 1) })).toEqual({
      slug: 'Slug must be at most 50 characters',
    });
  });

  it('англійська назва без латиниці й цифр — адресу треба вписати (інакше API — TAG_SLUG_REQUIRED)', () => {
    expect(fieldErrors({ nameEn: 'Трансфери', nameUk: 'Трансфери', slug: '' })).toEqual({
      slug: 'The English name has no latin letters or digits — type the address',
    });
    expect(fieldErrors({ nameEn: 'Трансфери', nameUk: 'Трансфери', slug: 'transfers' })).toEqual({});
    // Цифра — уже адреса: API візьме її з назви
    expect(fieldErrors({ nameEn: 'Євро 2028', nameUk: 'Євро-2028', slug: '' })).toEqual({});
  });

  it('помилка адреси — разом з помилками назв, а не після їх виправлення', () => {
    expect(fieldErrors({ nameEn: 'Т', nameUk: 'Т', slug: '' })).toEqual({
      nameEn: 'Name must be at least 2 characters',
      nameUk: 'Name must be at least 2 characters',
      slug: 'The English name has no latin letters or digits — type the address',
    });
  });

  it('перейменування — лише назви, обидві обов’язкові: адреса тегу не змінюється', () => {
    expect(tagNamesFormSchema.parse({ nameEn: ' Injuries ', nameUk: ' Травми', slug: 'ignored' })).toEqual({
      nameEn: 'Injuries',
      nameUk: 'Травми',
    });
    expect(tagNamesFormSchema.safeParse({ nameEn: 'Injuries', nameUk: ' ' }).success).toBe(false);
  });
});

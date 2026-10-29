import { describe, expect, it } from 'vitest';
import { parsePostPathSegment, postPathSegment } from './post-path';

describe('URL новини `{slug}-{number}` (D24)', () => {
  it.each([
    [
      'arsenal-beat-chelsea-1042',
      { slug: 'arsenal-beat-chelsea', number: 1042 },
    ],
    // Slug із цифрами в кінці — номер лише після останнього дефіса
    ['top-10-42', { slug: 'top-10', number: 42 }],
    ['derby-2026-7', { slug: 'derby-2026', number: 7 }],
    // Неканонічні, але з номером: сторінка перенаправить на канонічний slug
    ['old-title-7', { slug: 'old-title', number: 7 }],
    ['derby-007', { slug: 'derby', number: 7 }],
    ['-7', { slug: '', number: 7 }],
    ['derby-2147483647', { slug: 'derby', number: 2_147_483_647 }],
  ])('%j → %j', (segment, postRef) => {
    expect(parsePostPathSegment(segment)).toEqual(postRef);
  });

  it.each([
    // Старі URL: таймстемп не влазить у номер (INTEGER) → 404, а не 500
    'pa-pa-pa-lera-1775675859414',
    'derby-2147483648',
    'derby-0',
    // Без номера після дефіса
    'arsenal-beat-chelsea',
    '1042',
    'derby-',
    'derby-12a',
    'derby-1.5',
  ])('%j → null (404)', (segment) => {
    expect(parsePostPathSegment(segment)).toBeNull();
  });

  it('розбір збирає назад той самий сегмент', () => {
    const segment = postPathSegment({ slug: 'top-10', number: 42 });
    expect(segment).toBe('top-10-42');
    expect(parsePostPathSegment(segment)).toEqual({
      slug: 'top-10',
      number: 42,
    });
  });
});

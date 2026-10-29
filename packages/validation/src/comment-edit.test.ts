import { describe, expect, it } from 'vitest';
import {
  COMMENT_EDIT_WINDOW_MS,
  commentEditWindowStart,
  isCommentEditWindowOpen,
} from './comment-edit';

const NOW = new Date('2026-10-29T12:00:00.000Z');
const MINUTE_MS = 60 * 1000;

function createdMinutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * MINUTE_MS);
}

describe('Вікно зміни коментаря — 15 хв (D27)', () => {
  it('щойно опублікований і на 14-й хвилині — відкрите', () => {
    expect(isCommentEditWindowOpen(NOW, NOW)).toBe(true);
    expect(isCommentEditWindowOpen(createdMinutesAgo(14), NOW)).toBe(true);
  });

  it('за мілісекунду до 15 хв — ще відкрите, рівно 15 хв — уже закрите', () => {
    const almostClosed = new Date(NOW.getTime() - COMMENT_EDIT_WINDOW_MS + 1);
    expect(isCommentEditWindowOpen(almostClosed, NOW)).toBe(true);
    expect(isCommentEditWindowOpen(createdMinutesAgo(15), NOW)).toBe(false);
  });

  it('16-та хвилина — закрите', () => {
    expect(isCommentEditWindowOpen(createdMinutesAgo(16), NOW)).toBe(false);
  });

  it('годинник читача відстає (коментар «з майбутнього») — відкрите: остаточно вирішує API', () => {
    expect(isCommentEditWindowOpen(createdMinutesAgo(-2), NOW)).toBe(true);
  });

  it('межа запису в API — та сама: коментар, створений рівно на межі, змінити вже не можна', () => {
    const windowStart = commentEditWindowStart(NOW);
    expect(windowStart).toEqual(createdMinutesAgo(15));
    expect(isCommentEditWindowOpen(windowStart, NOW)).toBe(false);
  });
});

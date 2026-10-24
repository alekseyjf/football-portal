import { describe, expect, it } from 'vitest';
import { vanishedTagsMessage } from './postFormServerError';

describe('vanishedTagsMessage — UNKNOWN_TAG: який тег зник (D51)', () => {
  it('називає зниклі теги й кнопку, яку натиснути ще раз', () => {
    expect(vanishedTagsMessage(['Transfers'], 'Save changes')).toBe(
      'The tag “Transfers” was deleted while you were editing, so it’s removed from this post — click “Save changes” again.',
    );
    expect(vanishedTagsMessage(['Transfers', 'Injuries', 'VAR'], 'Create post')).toBe(
      'The tags “Transfers”, “Injuries” and “VAR” were deleted while you were editing, so they’re removed from this post — click “Create post” again.',
    );
  });

  it('зниклий тег був єдиною зміною збереженої новини — зберігати нічого (кнопка вимкнена), а не «натисніть ще раз»', () => {
    expect(vanishedTagsMessage(['Transfers'], null)).toBe(
      'The tag “Transfers” was deleted while you were editing, so it’s removed from this post. Nothing else has changed — there’s nothing to save.',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { formErrorParams, formFieldErrors, type FormIssue } from './form-errors';
import { displayNameSchema, newPasswordSchema, registerFormSchema } from './forms';
import { DISPLAY_NAME_MAX_LENGTH, PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from './index';

function firstIssue(result: { success: boolean; error?: { issues: FormIssue[] } }): FormIssue {
  const issue = result.error?.issues[0];
  if (!issue) throw new Error('очікували помилку');
  return issue;
}

describe('помилки форм — ключ у схемі, числа в issue (M1.9)', () => {
  it('межа вбудованої перевірки — з issue, а не з тексту', () => {
    const tooShort = firstIssue(newPasswordSchema.safeParse('short'));
    expect(tooShort.message).toBe('validation.password.tooShort');
    expect(formErrorParams(tooShort)).toEqual({ minimum: PASSWORD_MIN_LENGTH });

    const tooLong = firstIssue(displayNameSchema.safeParse('я'.repeat(DISPLAY_NAME_MAX_LENGTH + 1)));
    expect(tooLong.message).toBe('validation.name.tooLong');
    expect(formErrorParams(tooLong)).toEqual({ maximum: DISPLAY_NAME_MAX_LENGTH });
  });

  it('власна перевірка — числа з її params: пароль, довший за межу bcrypt у байтах', () => {
    const issue = firstIssue(newPasswordSchema.safeParse('ж'.repeat(PASSWORD_MAX_BYTES / 2 + 1)));
    expect(issue.message).toBe('validation.password.tooManyBytes');
    expect(formErrorParams(issue)).toEqual({ maxBytes: PASSWORD_MAX_BYTES });
  });

  it('помилки полів — перша на поле, текст будує translate з усього issue', () => {
    const result = registerFormSchema.safeParse({
      name: 'A',
      email: 'not-an-email',
      password: 'longenough',
      confirmPassword: 'different',
    });
    const errors = formFieldErrors(result.error?.issues ?? [], (issue) =>
      [issue.message, ...Object.values(formErrorParams(issue))].join(' '),
    );
    expect(errors).toEqual({
      name: { type: 'too_small', message: 'validation.name.tooShort 2' },
      email: { type: 'invalid_format', message: 'validation.email.invalid' },
      confirmPassword: { type: 'custom', message: 'validation.confirmPassword.mismatch' },
    });
  });
});

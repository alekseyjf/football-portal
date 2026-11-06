import { formFieldErrors, loginFormSchema, tagFormSchema, type FormIssue } from '@football-portal/validation/forms';
import { describe, expect, it } from 'vitest';
import { formIssueMessage, GENERIC_FORM_ERROR } from './formErrorMessages';

/** Текст помилки кожного поля — як його покаже форма адмінки. */
function shownErrors(issues: readonly FormIssue[] | undefined): Record<string, string> {
  const errors = formFieldErrors(issues ?? [], formIssueMessage);
  return Object.fromEntries(Object.entries(errors).map(([field, error]) => [field, error.message]));
}

describe('помилки форм адмінки — ключі спільних схем англійською (M1.9)', () => {
  it('тексти ті самі, що були в схемах до ключів, з межами з issue', () => {
    expect(shownErrors(tagFormSchema.safeParse({ nameEn: 'Т', nameUk: 'ж'.repeat(51), slug: '' }).error?.issues)).toEqual({
      nameEn: 'Name must be at least 2 characters',
      nameUk: 'Name must be at most 50 characters',
      slug: 'The English name has no latin letters or digits — type the address',
    });
    expect(shownErrors(loginFormSchema.safeParse({ email: 'admin', password: '' }).error?.issues)).toEqual({
      email: 'Invalid email address',
      password: 'Password is required',
    });
  });

  it('обкладинка не з фотобанку — текст називає кожен фотобанк із прикладом адреси (M1.8.3a)', () => {
    const issue = { code: 'custom', path: [], message: 'validation.coverImageUrl.notPhotoBank' } as FormIssue;
    expect(formIssueMessage(issue)).toBe(
      'Use a photo from Unsplash (https://images.unsplash.com/photo-…) or Pexels (https://images.pexels.com/photos/…/…)' +
        ' — right-click the photo → Copy image address',
    );
  });

  it('невідомий ключ — загальна помилка, а не ключ; власне правило форми — як є', () => {
    const unknownKey = { code: 'custom', path: [], message: 'validation.title.tooShiny' } as FormIssue;
    expect(formIssueMessage(unknownKey)).toBe(GENERIC_FORM_ERROR);
    const formRule = { code: 'custom', path: [], message: 'Choose when the post goes live' } as FormIssue;
    expect(formIssueMessage(formRule)).toBe('Choose when the post goes live');
  });
});

import { createTranslator } from 'next-intl';
import type { ResolverOptions } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  loginFormSchema,
  postTitleSchema,
  registerFormSchema,
  SITE_FORM_ERRORS,
  type FormIssue,
  type LoginFormValues,
  type RegisterFormValues,
} from '@football-portal/validation/forms';
import { routing, type AppLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import uk from '@/messages/uk.json';
import {
  formResolver,
  GENERIC_FORM_ERROR_KEY,
  translateFormIssue,
  type FormErrorTranslator,
} from './form-resolver';

const MESSAGES = { en, uk } satisfies Record<AppLocale, unknown>;

/** Як `useFormResolver`: перекладач next-intl, що на помилці формату кидає, а не підставляє ключ. */
function translatorFor(locale: AppLocale): FormErrorTranslator {
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    onError: (error) => {
      throw error;
    },
  });
  return (key, values) => t(key, values as never);
}

/** Аргументи першого рівня ICU-тексту: `{minimum, plural, one {# …}}` → `minimum`. */
function messageArguments(message: string): string[] {
  return [...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)]
    .map((match) => match[1])
    .sort();
}

function messageAt(locale: AppLocale, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      MESSAGES[locale],
    );
}

const SITE_KEYS = Object.entries(SITE_FORM_ERRORS).map(
  ([key, params]) => [key, [...params].sort()] as const,
);

/** Опції React Hook Form, з якими `formResolver` збирає помилки полів. */
const RESOLVER_OPTIONS = {
  fields: {},
  shouldUseNativeValidation: false,
} satisfies ResolverOptions<Record<string, unknown>>;

describe.each(routing.locales)('помилки форм сайту — %s (M1.9)', (locale) => {
  it.each(SITE_KEYS)(
    '%s — є в messages і бере числа %j з issue',
    (key, params) => {
      const message = messageAt(locale, key);
      expect(typeof message).toBe('string');
      expect(messageArguments(message as string)).toEqual(params);
      const values = Object.fromEntries(params.map((name) => [name, 8]));
      const text = translatorFor(locale)(
        key as keyof typeof SITE_FORM_ERRORS,
        values,
      );
      if (params.length > 0) expect(text).toContain('8');
    },
  );

  it('ключ не з форм сайту чи текст zod за замовчуванням — загальна помилка, а не ключ', () => {
    const translate = translatorFor(locale);
    const generic = translate(GENERIC_FORM_ERROR_KEY, {});
    const editorIssue = postTitleSchema.safeParse('').error?.issues[0];
    const defaultIssue = z.string().safeParse(1).error?.issues[0];
    for (const issue of [editorIssue, defaultIssue]) {
      expect(translateFormIssue(issue as FormIssue, translate)).toBe(generic);
    }
    expect(generic).not.toMatch(/^validation\./);
  });
});

describe('resolver форми — помилки полів мовою сторінки', () => {
  const translateUk = translatorFor('uk');

  it('вхід /uk: порожній пароль і неправильна пошта — українською', async () => {
    const resolve = formResolver(loginFormSchema, (issue) =>
      translateFormIssue(issue, translateUk),
    );
    const { errors } = await resolve(
      { email: 'not-an-email', password: '' } satisfies LoginFormValues,
      undefined,
      RESOLVER_OPTIONS,
    );
    expect(errors.email?.message).toBe('Неправильна адреса електронної пошти');
    expect(errors.password?.message).toBe('Введіть пароль');
  });

  it('реєстрація /uk: межа довжини — з числом і формою слова для нього', async () => {
    const resolve = formResolver(registerFormSchema, (issue) =>
      translateFormIssue(issue, translateUk),
    );
    const { errors } = await resolve(
      {
        name: 'А',
        email: 'fan@example.com',
        password: 'short',
        confirmPassword: 'short',
      } satisfies RegisterFormValues,
      undefined,
      RESOLVER_OPTIONS,
    );
    expect(errors.name?.message).toBe("Ім'я має містити щонайменше 2 символи");
    expect(errors.password?.message).toBe(
      'Пароль має містити щонайменше 8 символів',
    );
  });
});

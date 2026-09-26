/**
 * Zod-схеми форм web / admin. Числа — з `./index` (ті самі, що в DTO API),
 * тож клієнтська і серверна валідація не розходяться.
 */
import { z } from 'zod';
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  EMAIL_MAX_LENGTH,
  MEDIA_URL_PROTOCOLS,
  PASSWORD_INPUT_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  URL_MAX_LENGTH,
} from './index';

// ─── Поля ───

export const emailSchema = z
  .string()
  .trim()
  .max(EMAIL_MAX_LENGTH, `Email must be at most ${EMAIL_MAX_LENGTH} characters`)
  .email('Invalid email address');

/** Новий пароль — політика довжини. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

/** Введений пароль (логін): без мінімуму — старі акаунти мають коротші паролі. */
export const currentPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(PASSWORD_INPUT_MAX_LENGTH, 'Password is too long');

export const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN_LENGTH, `Name must be at least ${DISPLAY_NAME_MIN_LENGTH} characters`)
  .max(DISPLAY_NAME_MAX_LENGTH, `Name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`);

export const commentContentSchema = z
  .string()
  .trim()
  .min(COMMENT_MIN_LENGTH, `Comment must be at least ${COMMENT_MIN_LENGTH} characters`)
  .max(COMMENT_MAX_LENGTH, `Comment must be at most ${COMMENT_MAX_LENGTH} characters`);

/** `coverImage` / `videoUrl` — лише https (як `@IsUrl` у DTO постів). */
export const mediaUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, `URL must be at most ${URL_MAX_LENGTH} characters`)
  .refine(
    (value) => hasAllowedProtocol(value, MEDIA_URL_PROTOCOLS),
    'Must be an https:// URL',
  );

function hasAllowedProtocol(value: string, protocols: readonly string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol.replace(/:$/, ''));
  } catch {
    return false;
  }
}

// ─── Форми ───

export const loginFormSchema = z.object({
  email: emailSchema,
  password: currentPasswordSchema,
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z
  .object({
    name: displayNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export const commentFormSchema = z.object({
  content: commentContentSchema,
});
export type CommentFormValues = z.infer<typeof commentFormSchema>;

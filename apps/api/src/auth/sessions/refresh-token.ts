import { createHash, randomBytes } from 'node:crypto';

const REFRESH_TOKEN_BYTES = 32;

/** Opaque refresh-токен: 256 біт випадковості, не JWT — сам по собі нічого не означає. */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/**
 * У БД лише SHA-256: витік таблиці `AuthSession` не дає робочих токенів.
 * Повільний хеш (bcrypt) не потрібен — токен випадковий, перебір неможливий.
 */
export function hashRefreshToken(rawRefreshToken: string): string {
  return createHash('sha256').update(rawRefreshToken).digest('hex');
}

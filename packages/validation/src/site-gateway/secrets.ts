import { createHash, timingSafeEqual } from 'node:crypto';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Рядки однакові — порівняння за сталий час і для різної довжини: порівнюємо SHA-256 обох (довжина дайджесту стала),
 * тож ні час, ні виняток `timingSafeEqual` не підказують, скільки символів секрету вгадано.
 */
export function secretsEqual(provided: string, expected: string): boolean {
  return timingSafeEqual(sha256(provided), sha256(expected));
}

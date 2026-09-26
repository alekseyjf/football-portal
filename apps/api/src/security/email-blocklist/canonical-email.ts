/** Gmail ігнорує крапки в локальній частині; `googlemail.com` — той самий сервіс. */
const GMAIL_DOMAIN = 'gmail.com';
const GMAIL_DOMAIN_ALIASES = new Set([GMAIL_DOMAIN, 'googlemail.com']);

/**
 * Канонічна адреса — лише для блоклиста, не для акаунтів: інакше блок обходиться
 * через `user+1@…` (plus-addressing: Gmail, Outlook, iCloud, Fastmail…) і `u.s.e.r@gmail.com`.
 * Хибний збіг можливий лише на доменах, де `+` — частина імені скриньки (рідкість).
 *
 * `normalizedEmail` — уже `toLowerCase().trim()`.
 */
export function canonicalizeEmail(normalizedEmail: string): string {
  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex < 0) return normalizedEmail;

  const domain = normalizedEmail.slice(atIndex + 1);
  let localPart = normalizedEmail.slice(0, atIndex).split('+')[0];

  if (GMAIL_DOMAIN_ALIASES.has(domain)) {
    localPart = localPart.replaceAll('.', '');
    return `${localPart}@${GMAIL_DOMAIN}`;
  }
  return `${localPart}@${domain}`;
}

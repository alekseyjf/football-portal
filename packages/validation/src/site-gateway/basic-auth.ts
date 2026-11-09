import { secretsEqual } from './secrets';

/** Спільний логін і пароль тест-сервера (M1.11.6, 👤 У21): сайт, адмінка і Swagger через сайт. */
export interface BasicAuthCredentials {
  user: string;
  password: string;
}

/** Схема — без урахування регістру (RFC 9110). */
const BASIC_SCHEME = /^basic\s+(\S+)$/i;

/** Назва в діалозі браузера; той самий логін для сайту й адмінки — і назва одна. */
const REALM = '12Yards test server';

/**
 * `Authorization: Basic …` містить потрібні логін і пароль. Пароль може мати `:` — ділимо за першим (RFC 7617).
 * Без облікових даних (`null` — змінні тесту невалідні) не пускаємо нікого.
 */
export function isBasicAuthorized(
  authorization: string | null,
  credentials: BasicAuthCredentials | null,
): boolean {
  if (!credentials || !authorization) return false;
  const encoded = BASIC_SCHEME.exec(authorization.trim())?.[1];
  if (!encoded) return false;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return false;
  // Обидва порівняння — завжди: час відповіді не підкаже, що логін уже вгадано
  const isUserCorrect = secretsEqual(
    decoded.slice(0, separatorIndex),
    credentials.user,
  );
  const isPasswordCorrect = secretsEqual(
    decoded.slice(separatorIndex + 1),
    credentials.password,
  );
  return isUserCorrect && isPasswordCorrect;
}

/** 401 з викликом: браузер показує діалог логіну й далі шле пароль сам. */
export function basicAuthChallenge(): Response {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

import { isIP } from 'node:net';

/** Імена, що не виходять в інтернет: локальна машина, mDNS, внутрішні DNS хостингів і Docker. */
const PRIVATE_NAME_SUFFIXES = ['.localhost', '.local', '.internal'];

/** IPv4 приватних мереж і локальні: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16 (link-local). */
function isPrivateIpv4(address: string): boolean {
  const [first, second] = address.split('.').map(Number);
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

/** IPv6: `::1`, унікальні локальні `fc00::/7`, link-local `fe80::/10`. */
function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    /^f[cd][0-9a-f]{2}:/.test(normalized) ||
    /^fe[89ab][0-9a-f]:/.test(normalized)
  );
}

/**
 * Чи хост — у приватній мережі (`URL.hostname`): ім'я сервісу Docker (`web` — без крапки), `localhost`, `*.internal`,
 * `*.local` чи приватна адреса IP. Так у production дозволено http між контейнерами однієї мережі (вебхук web, D57).
 * Лише за записом адреси: DNS не питаємо — для адрес з env, а не від користувача.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateIpv4(host);
  if (ipVersion === 6) return isPrivateIpv6(host);
  return (
    host === 'localhost' ||
    !host.includes('.') ||
    PRIVATE_NAME_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

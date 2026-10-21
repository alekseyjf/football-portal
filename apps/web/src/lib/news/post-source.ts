import { SOURCE_URL_PROTOCOLS } from '@football-portal/validation';

/** Джерело новини для рядка «Джерело: …» під текстом (D26). */
export interface PostSourceLink {
  /** Назва джерела, а без неї — домен адреси без `www.` */
  label: string;
  /** `null` — адреса не http(s): назву показуємо без посилання */
  href: string | null;
}

const WWW_PREFIX = /^www\./;

/**
 * Адреса, на яку можна поставити посилання, — лише http(s), як дозволяє API (`IsSourceUrl`). Перевіряємо
 * й тут: рядок з прямої правки в БД (`javascript:…`) у `href` не потрапить.
 */
function parseLinkableUrl(sourceUrl: string): URL | null {
  try {
    const url = new URL(sourceUrl);
    return SOURCE_URL_PROTOCOLS.includes(url.protocol.replace(/:$/, ''))
      ? url
      : null;
  } catch {
    // Не адреса взагалі — посилання немає, лишається назва (якщо є)
    return null;
  }
}

/** Що показати в рядку джерела; `null` — нічого: джерела немає або воно без назви й без придатної адреси. */
export function postSourceLink(source: {
  sourceUrl: string | null;
  sourceName: string | null;
}): PostSourceLink | null {
  const url = source.sourceUrl ? parseLinkableUrl(source.sourceUrl) : null;
  // `hostname` — уже в нижньому регістрі й без порту; домен кирилицею — у punycode (`xn--…`),
  // тож таким джерелам редакція вписує назву (editor-guide.md, «Джерело»)
  const label =
    source.sourceName ?? url?.hostname.replace(WWW_PREFIX, '') ?? null;
  if (!label) return null;
  return { label, href: url?.href ?? null };
}

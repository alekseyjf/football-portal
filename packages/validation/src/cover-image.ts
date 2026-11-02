/** Фотобанк, з якого можна брати обкладинку новини. */
export interface CoverImageHost {
  /** Назва — у підказці редактору */
  name: string;
  /** Точна назва хоста: без піддоменів за маскою */
  hostname: string;
  /**
   * Шлях фото на CDN — у форматі `pathname` з `images.remotePatterns` Next, сайт бере його як є: `*` — щонайменше один
   * символ у межах сегмента (без `/`). `**` не вживаємо: його правила в Next інші.
   */
  pathname: string;
}

/**
 * Звідки можна брати обкладинку (M1.8.3a, D44): CDN фотобанків з вільною ліцензією, лише самі фото — аватарки авторів і
 * відео на тих самих хостах не підходять. Unsplash+ (платні) — інший хост, `plus.unsplash.com`. Нове джерело — рішення
 * про права на фото (OQ-29), тож воно з'являється в PR з рев'ю, а не в змінній середовища.
 */
export const COVER_IMAGE_HOSTS: readonly CoverImageHost[] = [
  { name: 'Unsplash', hostname: 'images.unsplash.com', pathname: '/photo-*' },
  { name: 'Pexels', hostname: 'images.pexels.com', pathname: '/photos/*/*' },
];

const COVER_IMAGE_PROTOCOL = 'https:';

/**
 * `*` шляху — не ширше, ніж у Next (`picomatch`, `dot: true`), щоб кожну прийняту адресу пропустив і оптимізатор сайту:
 * там `*` на місці цілого сегмента порожнім не буває (`/photos/1/` — ні), тож тут — щонайменше один символ.
 */
function pathnamePatternRegExp(pathname: string): RegExp {
  const literalParts = pathname.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${literalParts.join('[^/]+')}$`);
}

const COVER_IMAGE_URL_RULES = COVER_IMAGE_HOSTS.map((host) => ({
  hostname: host.hostname,
  pathnamePattern: pathnamePatternRegExp(host.pathname),
}));

/**
 * Адреса обкладинки — з дозволеного фотобанку (`COVER_IMAGE_HOSTS`): https, точна назва хоста без порту й `user@`,
 * шлях фото на ньому. Адресу розбирає лише `new URL()` — так само, як браузер і оптимізатор Next: регістр хоста, `%2e`
 * і `..` у шляху він зводить до одного вигляду ще до порівняння. Одна функція для API, адмінки й сайту.
 */
export function isAllowedCoverImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== COVER_IMAGE_PROTOCOL || url.username || url.password || url.port) return false;
  return COVER_IMAGE_URL_RULES.some(
    (rule) => url.hostname === rule.hostname && rule.pathnamePattern.test(url.pathname),
  );
}

/** Як виглядає адреса фото з фотобанку: `https://images.unsplash.com/photo-…`. */
export function coverImageUrlExample(host: CoverImageHost): string {
  return `https://${host.hostname}${host.pathname.replaceAll('*', '…')}`;
}

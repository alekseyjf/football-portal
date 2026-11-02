import type { PostEvent } from '../posts/post-events';

/**
 * Порт «сказати сайту, що його сторінки застаріли» (D57, clean-code Rule 3): сайт кешує сторінки й sitemap і оновлює їх
 * на сповіщення, а без нього — за TTL. Адаптер — вебхук web (`web-webhook/`); інший спосіб (черга, CDN) — інший адаптер.
 */
export const SITE_REVALIDATOR = Symbol('SITE_REVALIDATOR');

export interface SiteRevalidator {
  /** Новина з'явилась, змінилась чи зникла; збій — виняток (той, хто викликав, лише логує). Не налаштовано — нічого. */
  postChanged(event: PostEvent): Promise<void>;
  /** Змінилась головна новина (D56) — так само: збій — виняток, не налаштовано — нічого. */
  homeChanged(): Promise<void>;
}

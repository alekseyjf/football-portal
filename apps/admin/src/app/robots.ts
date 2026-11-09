import type { MetadataRoute } from 'next';

/** Адмінка — не для пошуковиків у жодному середовищі (M1.11.6); заголовок `X-Robots-Tag` — `next.config.ts`. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}

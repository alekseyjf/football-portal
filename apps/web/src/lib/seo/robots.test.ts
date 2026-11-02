import { describe, expect, it } from 'vitest';
import { robotsRules } from './robots';

const SITEMAP_URL = 'https://portal.test/sitemap.xml';

describe('robots.txt (M1.8.3)', () => {
  it('сайт закритий — Disallow: / і без sitemap', () => {
    expect(robotsRules({ isIndexed: false, sitemapUrl: SITEMAP_URL })).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    });
  });

  it('сайт відкритий — усе дозволено й повна адреса sitemap index', () => {
    expect(robotsRules({ isIndexed: true, sitemapUrl: SITEMAP_URL })).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: SITEMAP_URL,
    });
  });
});

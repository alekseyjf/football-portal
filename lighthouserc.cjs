/*
 * Lighthouse CI (M1.8.4, D34): SEO і Best Practices на зібраному сайті — головна, стрічка, новина; профіль — мобільний
 * (за замовчуванням Lighthouse). Стенд — `next start` з `SITE_INDEXING=true`: закритий сайт віддає `X-Robots-Tag:
 * noindex`, і SEO-аудит не дасть 100. Номер новини залежить від засіву стенда, тож її адресу задає `LHCI_POST_PATH`.
 * `pnpm lighthouse` — прогрівальний прохід (кеш даних і фото оптимізатора; не рахується), далі 3 заміри й пороги.
 * Job у GitHub Actions — M1.12.2.
 */
const baseUrl = process.env.LHCI_BASE_URL ?? 'http://localhost:3000';
const postPath = process.env.LHCI_POST_PATH;
if (!postPath) {
  throw new Error('LHCI_POST_PATH is required: /uk/news/{slug}-{number} of a stand post');
}

/** Поріг — за медіаною прогонів: за замовчуванням lhci бере найкращий із них (`optimistic`). */
const median = { aggregationMethod: 'median' };

module.exports = {
  ci: {
    collect: {
      // Мова — українська: основна аудиторія, а SEO-аудит від мови не залежить (бриф M1.8.4)
      url: ['/uk', '/uk/news', postPath].map((path) => new URL(path, baseUrl).href),
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:seo': ['error', { ...median, minScore: 1 }],
        'categories:best-practices': ['error', { ...median, minScore: 0.9 }],
        // LCP і CLS локально лише фіксуємо (👤 2026-11-02): ціль — < 2,5 с і < 0,1, перевірка — на тест-сервері
        'largest-contentful-paint': ['warn', { ...median, maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { ...median, maxNumericValue: 0.1 }],
      },
    },
    // Звіти — лише локально (тека в .gitignore): temporary-public-storage виклав би їх у публічне сховище
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};

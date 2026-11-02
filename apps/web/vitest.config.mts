import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Unit-тести web (D30): чисті функції, `proxy.ts` і вебхук `/api/revalidate` — без браузера і без API. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Як у збірці Next на сервері: `server-only` — порожній модуль (поза `react-server` пакет кидає виняток)
      'server-only': 'next/dist/compiled/server-only/empty.js',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: {
      // ESM next-intl імпортує `next/server` без розширення — Node так не резолвить, Vite — так
      deps: { inline: ['next-intl'] },
    },
  },
});

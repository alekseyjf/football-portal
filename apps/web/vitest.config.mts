import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Unit-тести web (D30): чисті функції й `proxy.ts` — без браузера і без API. */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
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

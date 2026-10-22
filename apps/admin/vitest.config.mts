import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Unit-тести адмінки (D30): правила форм і побудова запитів — без браузера і без API. */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

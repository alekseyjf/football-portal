import { defineConfig } from 'vitest/config';

/** Unit-тести спільних правил (slug, межі, zod-схеми) — без браузера і без API. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

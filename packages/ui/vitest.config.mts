import { defineConfig } from 'vitest/config';

/** Unit-тести спільного UI: статична розмітка (`renderToStaticMarkup`), без браузера. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.tsx'],
  },
});

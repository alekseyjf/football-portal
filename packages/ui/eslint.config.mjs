import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Ті самі правила, що в застосунках, які компілюють цей код (React, хуки, доступність, TypeScript).
// Правила саме Next вимкнено: пакет від Next не залежить — сторінок у ньому немає, а зображення
// в тексті новини — звичайний <img> з будь-якого https-хоста
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;

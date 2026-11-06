import { Geist } from 'next/font/google';

/**
 * Шрифт сайту — один для `[locale]/layout.tsx` і загальної 404 (`app/not-found.tsx`); клас — на `<html>`.
 * `subsets` задає лише preload (кирилиця — увесь текст `/uk` і «Українська» в перемикачі мов): `@font-face` решти
 * підмножин Google (latin-ext, cyrillic-ext, vietnamese) лишаються в CSS, і браузер вантажить такий файл, лише
 * коли на сторінці є його символ (`unicode-range`, напр. «ş» у назві клубу). Без `weight`: Geist змінний, Google
 * віддає той самий файл на кожне насичення — `weight` лише множив би `@font-face` і малював би 600 як 700 (M1.9).
 */
export const geist = Geist({ subsets: ['latin', 'cyrillic'] });

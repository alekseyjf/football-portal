import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { geist } from './fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');
  const tMeta = await getTranslations('meta');
  // `absolute`: для `notFound()` сторінки поверх ще лягає шаблон `[locale]/layout.tsx`
  // («%s | Футбольний портал») — без нього назва подвоювалась; для невідомого шляху шаблону немає
  return { title: { absolute: `${t('title')} | ${tMeta('title')}` } };
}

/**
 * Єдина 404 застосунку: `notFound()` сторінок (новина, матч), невідомі шляхи (`/ua/leagues`,
 * поки сторінок етапу 7 немає) і шляхи поза локаллю. Кореневий layout повертає лише `children`
 * (`html` / `body` — у `[locale]/layout.tsx`), тож документ тут свій — інакше Next:
 * «Missing <html> and <body> tags in the root layout». Мова — з next-intl (запит пройшов
 * `proxy.ts`); поза локаллю — мова за замовчуванням.
 */
export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations('notFound');

  return (
    <html lang={locale} className={geist.className}>
      <body>
        {/* Фон і колір — на обгортці, як у `[locale]/layout.tsx`: правило `body` у globals.css
            поза шарами Tailwind і перебиває утиліти на самому `body` */}
        <div className="min-h-screen bg-gray-950 text-white">
          <main className="min-h-screen flex items-center justify-center text-center px-4">
            <div>
              <p className="text-6xl mb-4" aria-hidden>
                ⚽
              </p>
              <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
              <p className="text-gray-400 mb-6">{t('description')}</p>
              <Link
                href={`/${locale}`}
                className="inline-block bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg transition-colors"
              >
                {t('backHome')}
              </Link>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

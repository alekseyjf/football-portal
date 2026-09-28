import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { NavbarClient } from '@/components/layout/NavbarClient';

export async function Navbar() {
  const t = await getTranslations('nav');

  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Вузький екран (< 640 px) — лише ⚽: з назвою правий блок виходив за екран (бургер — етап 7.1) */}
        <Link
          href="/"
          aria-label={t('brand')}
          className="text-xl font-bold flex items-center gap-2 shrink-0"
        >
          <span aria-hidden>⚽</span>
          <span className="hidden sm:inline">{t('brand')}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">
            {t('news')}
          </Link>
          <Link href="/matches" className="hover:text-white transition-colors">
            {t('matches')}
          </Link>
          {/* Сторінок ліг / клубів ще немає (етап 7.1 / 7.2) → 404. Prefetch 404-маршруту в Chrome
              лишається «незавершеним» (клієнт Next не дочитує тіло) на кожній сторінці —
              `prefetch={false}` прибрати разом із появою сторінок */}
          <Link
            href="/leagues"
            prefetch={false}
            className="hover:text-white transition-colors"
          >
            {t('leagues')}
          </Link>
          <Link
            href="/clubs"
            prefetch={false}
            className="hover:text-white transition-colors"
          >
            {t('clubs')}
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LocaleSwitcher />
          <NavbarClient />
        </div>
      </div>
    </header>
  );
}

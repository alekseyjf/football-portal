import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { NavbarClient } from '@/components/layout/NavbarClient';

export async function Navbar() {
  const t = await getTranslations('nav');

  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-bold flex items-center gap-2 shrink-0">
          ⚽ <span>{t('brand')}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">
            {t('news')}
          </Link>
          <Link href="/leagues" className="hover:text-white transition-colors">
            {t('leagues')}
          </Link>
          <Link href="/clubs" className="hover:text-white transition-colors">
            {t('clubs')}
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <LocaleSwitcher />
          <NavbarClient />
        </div>
      </div>
    </header>
  );
}

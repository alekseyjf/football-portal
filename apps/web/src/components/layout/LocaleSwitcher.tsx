'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('locale');

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900/60 p-0.5 text-xs"
      role="group"
      aria-label={t('label')}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => {
            // Query лишається: `?league=CL` на головній не скидається на лігу за замовчуванням.
            // Читаємо в момент кліку, а не `useSearchParams`: Navbar є і на статичних сторінках
            router.replace(`${pathname}${window.location.search}`, {
              locale: loc,
            });
          }}
          className={[
            'rounded-md px-2.5 py-1 font-medium transition-colors',
            loc === locale
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white',
          ].join(' ')}
          aria-current={loc === locale ? 'true' : undefined}
          aria-label={t(loc)}
        >
          {/* До 1024 px — код мови (`EN` / `UA`): з повними назвами навбар не влазить */}
          <span className="lg:hidden" aria-hidden>
            {loc.toUpperCase()}
          </span>
          <span className="hidden lg:inline" aria-hidden>
            {t(loc)}
          </span>
        </button>
      ))}
    </div>
  );
}

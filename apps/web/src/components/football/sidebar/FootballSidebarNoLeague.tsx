'use client';

import { useTranslations } from 'next-intl';

export function FootballSidebarNoLeague() {
  const tFootball = useTranslations('football');

  return (
    <div className="border-l-4 border-l-red-600 bg-black/85 border border-neutral-800 p-4 text-sm text-neutral-400">
      <p className="font-semibold text-neutral-200 uppercase tracking-wide text-xs mb-2">
        {tFootball('standingsTitle')}
      </p>
      <p>{tFootball('noLeague')}</p>
    </div>
  );
}

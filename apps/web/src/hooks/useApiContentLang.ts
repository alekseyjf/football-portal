'use client';

import { useLocale } from 'next-intl';
import type { ApiContentLanguage } from '@/lib/api/types';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';

export function useApiContentLang(): ApiContentLanguage {
  const locale = useLocale();
  return localeToApiContentLang(locale);
}

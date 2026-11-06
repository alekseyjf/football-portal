import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { isAppLocale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { pageShareCardHref } from '@/lib/seo/share-card';
import { RegisterForm } from './RegisterForm';

type Props = { params: Promise<{ locale: string }> };

/** Шукати тут нічого: `noindex, follow` і поза sitemap (D34). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({
    locale,
    href: '/auth/register',
    isIndexable: false,
    title: tNav('register'),
    description: tMeta('description'),
    siteName: tMeta('title'),
    shareCardHref: pageShareCardHref('home'),
  });
}

export default async function RegisterPage() {
  const tNav = await getTranslations('nav');
  const tAuth = await getTranslations('auth');
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span aria-hidden>⚽</span> {tNav('brand')}
          </h1>
          <p className="text-gray-400 mt-2">{tAuth('registerSubtitle')}</p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Navbar } from '@/components/layout/Navbar';
import { QueryProviders } from '@/providers/QueryProvider';
import { TimeZoneSync } from '@/providers/TimeZoneSync';
import { isAppLocale, routing } from '@/i18n/routing';
import { geist } from '../fonts';
import '../globals.css';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    return {
      title: 'Football Portal',
      description: 'Football news, matches and clubs',
    };
  }
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: {
      default: t('title'),
      template: `%s | ${t('title')}`,
    },
    description: t('description'),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={geist.className}>
      <body>
        {/* `timeZone` провайдер бере з `i18n/request.ts` (успадкування з сервера) */}
        <NextIntlClientProvider messages={messages}>
          <TimeZoneSync />
          <QueryProviders>
            <div className="min-h-screen bg-gray-950 text-white">
              <Navbar />
              {children}
            </div>
          </QueryProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

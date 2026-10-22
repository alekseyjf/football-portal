import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/i18n/request.ts',
  experimental: {
    /** Генерує `messages/en.d.json.ts` для типізації аргументів ICU (next dev / build). */
    createMessagesDeclaration: './src/messages/en.json',
  },
});

const nextConfig: NextConfig = {
  // Спільний UI — без збірки: пакет віддає TypeScript-джерела, Next компілює їх сам
  transpilePackages: ['@football-portal/ui'],
};

export default withNextIntl(nextConfig);

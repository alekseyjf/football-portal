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
  /* config options here */
};

export default withNextIntl(nextConfig);

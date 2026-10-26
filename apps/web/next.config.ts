import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/i18n/request.ts',
  experimental: {
    /** Генерує `messages/en.d.json.ts` для типізації аргументів ICU (next dev / build). */
    createMessagesDeclaration: './src/messages/en.json',
  },
});

/**
 * Content-Security-Policy поки — лише `frame-src` (D54): iframe на сайті — тільки плеєр відео з `youtube-nocookie.com`.
 * Повна політика (`script-src`, `img-src` …) — перед продом (M3.2).
 */
const CONTENT_SECURITY_POLICY = 'frame-src https://www.youtube-nocookie.com';

const nextConfig: NextConfig = {
  // Спільний UI — без збірки: пакет віддає TypeScript-джерела, Next компілює їх сам
  transpilePackages: ['@football-portal/ui'],
  images: {
    // Прев'ю відео YouTube (D54) віддає наш сервер: браузер читача до Google до кліку не звертається. Оптимізатор
    // завантажить лише `i.ytimg.com/vi/…` — чужий хост через нього не підставити. Обкладинки — `unoptimized` (D44)
    remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**', search: '' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

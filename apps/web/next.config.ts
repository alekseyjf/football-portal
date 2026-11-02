import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { IMAGE_REMOTE_PATTERNS } from './src/lib/images/remote-patterns';

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
  // Окрема тека збірки — лише для стража `scripts/check-runtime-env.mjs`: він збирає з тестовою адресою API й не
  // затирає `.next` розробника
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Спільний UI — без збірки: пакет віддає TypeScript-джерела, Next компілює їх сам
  transpilePackages: ['@football-portal/ui'],
  images: {
    // Прев'ю відео YouTube (D54) і обкладинки з фотобанків (M1.8.3a) віддає наш сервер: розмір під екран і WebP, а
    // браузер читача до Google до кліку не звертається. Чужий хост через оптимізатор не підставити
    remotePatterns: IMAGE_REMOTE_PATTERNS,
    // Редиректи `remotePatterns` не перевіряє (документація Next): відкритий редирект на дозволеному хості завів би
    // оптимізатор куди завгодно. CDN фотобанків і YouTube віддають фото напряму (перевірено, M1.8.3a)
    maximumRedirects: 0,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

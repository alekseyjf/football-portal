import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Спільний UI — без збірки: пакет віддає TypeScript-джерела, Next компілює їх сам
  transpilePackages: ['@football-portal/ui'],
  async headers() {
    return [
      {
        // Адмінка — не для пошуковиків у жодному середовищі (M1.11.6); `robots.txt` — `app/robots.ts`
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
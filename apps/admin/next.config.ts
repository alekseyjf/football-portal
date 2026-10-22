import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Спільний UI — без збірки: пакет віддає TypeScript-джерела, Next компілює їх сам
  transpilePackages: ['@football-portal/ui'],
};

export default nextConfig;
import { COVER_IMAGE_HOSTS } from '@football-portal/validation';
import type { NextConfig } from 'next';

type RemotePattern = Exclude<
  NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number],
  URL
>;

/**
 * Що завантажує оптимізатор `next/image` (`images.remotePatterns` у `next.config.ts`): точні хости, лише https, без
 * порту, шлях — до файла чи каталогу фото. Інше `/_next/image` відхиляє (400): наш сервер чужий хост не завантажить.
 */
export const IMAGE_REMOTE_PATTERNS: RemotePattern[] = [
  // Прев'ю відео YouTube (D54): сайт просить лише цей файл (`PostVideo.tsx`)
  {
    protocol: 'https',
    hostname: 'i.ytimg.com',
    port: '',
    pathname: '/vi/*/hqdefault.jpg',
    search: '',
  },
  // Обкладинки (M1.8.3a): ті самі фотобанки й шляхи, що приймає API (`isAllowedCoverImageUrl`), — інакше фото, яке
  // API прийняло, сайт не показав би. Параметри — будь-які: ними CDN фотобанку задає розмір фото (editor-guide.md)
  ...COVER_IMAGE_HOSTS.map(
    ({ hostname, pathname }): RemotePattern => ({
      protocol: 'https',
      hostname,
      port: '',
      pathname,
    }),
  ),
];

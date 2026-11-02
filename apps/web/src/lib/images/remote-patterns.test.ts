import {
  COVER_IMAGE_HOSTS,
  isAllowedCoverImageUrl,
} from '@football-portal/validation';
// Той самий матчер, яким `/_next/image` перевіряє адресу (і `next/image` у dev)
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern';
import { describe, expect, it } from 'vitest';
import { IMAGE_REMOTE_PATTERNS } from './remote-patterns';

function isOptimizerAllowed(url: string): boolean {
  return hasRemoteMatch([], IMAGE_REMOTE_PATTERNS, new URL(url));
}

/** Адреса фото, як її копіює редактор, — для кожного фотобанку списку. */
const PHOTO_URL_BY_HOSTNAME: Record<string, string> = {
  'images.unsplash.com':
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=630&fit=crop&q=80',
  'images.pexels.com':
    'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=1260',
};

describe('images.remotePatterns — оптимізатор завантажує лише дозволене (M1.8.3a)', () => {
  it.each(COVER_IMAGE_HOSTS.map((host) => host.hostname))(
    'обкладинку з %s, яку прийняв API, сайт віддає через оптимізатор',
    (hostname) => {
      const photoUrl = PHOTO_URL_BY_HOSTNAME[hostname];
      // Новий фотобанк у списку — спершу його адреса тут
      expect(photoUrl).toBeDefined();
      expect(isAllowedCoverImageUrl(photoUrl)).toBe(true);
      expect(isOptimizerAllowed(photoUrl)).toBe(true);
    },
  );

  it.each([
    'https://IMAGES.UNSPLASH.COM/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com:443/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com/photo-1/%2e%2e/photo-2',
    'https://images.pexels.com/photos/1/a%20b.jpeg?x=1#y',
  ])(
    '%s: адресу, яку прийняв API, оптимізатор теж пропускає — на сайті не буде 400',
    (url) => {
      expect(isAllowedCoverImageUrl(url)).toBe(true);
      expect(isOptimizerAllowed(url)).toBe(true);
    },
  );

  it('порожні й крапкові сегменти, `/` наприкінці, кодування: жодної адреси, яку прийняв би API, а оптимізатор — ні', () => {
    const paths = [
      [
        'images.unsplash.com',
        [
          '/photo-',
          '/photo-/',
          '//photo-1',
          '/photo-1/',
          '/photo-..',
          '/photo-%2F1',
          '/photo-1%2F..',
        ],
      ],
      [
        'images.pexels.com',
        [
          '/photos//a.jpeg',
          '/photos/1/',
          '/photos/1//',
          '/photos//',
          '/photos/1/a.jpeg/',
          '/photos/./1/a.jpeg',
          '/photos/.../a',
        ],
      ],
      [
        'images.pexels.com',
        [
          '/photos/1/..a',
          '/photos/1/%2e%2e',
          '/photos/%2e/a.jpeg',
          '/photos/1/a.jpeg?w=1#x',
        ],
      ],
    ] as const;
    const urls = paths.flatMap(([hostname, pathnames]) =>
      pathnames.map((pathname) => `https://${hostname}${pathname}`),
    );
    expect(
      urls.filter(
        (url) => isAllowedCoverImageUrl(url) && !isOptimizerAllowed(url),
      ),
    ).toEqual([]);
  });

  it.each([
    'https://e2e.test/news/derby-cover.jpg',
    'https://plus.unsplash.com/premium_photo-1661963212517-830bbb7d76fc',
    'https://cdn.images.unsplash.com/photo-1574629810360-7efbbe195018',
    'http://images.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com:8443/photo-1574629810360-7efbbe195018',
    'https://images.pexels.com/videos/3191572/free-video-3191572.jpg',
  ])('%s — оптимізатор не завантажить', (url) => {
    expect(isOptimizerAllowed(url)).toBe(false);
  });

  it("YouTube — лише прев'ю hqdefault.jpg без параметрів, як його просить сайт (D54)", () => {
    expect(
      isOptimizerAllowed('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'),
    ).toBe(true);
    expect(
      isOptimizerAllowed(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      ),
    ).toBe(false);
    expect(
      isOptimizerAllowed(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg?x=1',
      ),
    ).toBe(false);
    expect(
      isOptimizerAllowed(
        'https://i.ytimg.com/an_webp/dQw4w9WgXcQ/mqdefault_6s.webp',
      ),
    ).toBe(false);
  });
});

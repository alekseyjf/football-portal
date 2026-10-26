import { describe, expect, it } from 'vitest';
import { normalizeYouTubeUrl, parseYouTubeVideoId, youtubeWatchUrl } from './youtube';

const VIDEO_ID = 'dQw4w9WgXcQ';
const CANONICAL_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

describe('Посилання YouTube (D54)', () => {
  it.each([
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?v=${VIDEO_ID}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?feature=share&v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}?si=AbCdEf123`,
    `https://youtu.be/${VIDEO_ID}/`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}?start=10`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    `  https://WWW.YouTube.com/watch?v=${VIDEO_ID}  `,
  ])('%s → id відео і канонічне посилання', (url) => {
    expect(parseYouTubeVideoId(url)).toBe(VIDEO_ID);
    expect(normalizeYouTubeUrl(url)).toBe(CANONICAL_URL);
  });

  it.each([
    // Не https, чужий чи схожий хост
    `http://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://vimeo.com/123456789`,
    `https://youtube.com.evil.example/watch?v=${VIDEO_ID}`,
    `https://music.youtube.com/watch?v=${VIDEO_ID}`,
    `javascript:alert('${VIDEO_ID}')`,
    // Сторінка YouTube, але не відео
    'https://www.youtube.com/',
    'https://www.youtube.com/@premierleague',
    'https://www.youtube.com/channel/UCG5qGWdu8nIRZqJ_GgDwQ-w',
    `https://www.youtube.com/playlist?list=PL${VIDEO_ID}`,
    `https://www.youtube.com/watch/${VIDEO_ID}`,
    `https://www.youtube.com/shorts/${VIDEO_ID}/extra`,
    `https://youtu.be/${VIDEO_ID}/extra`,
    `https://www.youtube-nocookie.com/shorts/${VIDEO_ID}`,
    // id не того формату
    'https://youtu.be/short',
    `https://www.youtube.com/watch?v=${VIDEO_ID}x`,
    'https://www.youtube.com/watch?v=dQw4w9WgXc!',
    'https://www.youtube.com/watch',
    // Логін чи порт
    `https://user:secret@www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com:8443/watch?v=${VIDEO_ID}`,
    'не посилання',
    '',
  ])('%j — не відео YouTube', (url) => {
    expect(parseYouTubeVideoId(url)).toBeNull();
    expect(normalizeYouTubeUrl(url)).toBeNull();
  });

  it('канонічне посилання розбирається в той самий id', () => {
    expect(parseYouTubeVideoId(youtubeWatchUrl(VIDEO_ID))).toBe(VIDEO_ID);
  });
});

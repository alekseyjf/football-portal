/** Id відео YouTube: 11 символів — латиниця, цифри, `-` і `_`. */
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const YOUTUBE_NOCOOKIE_HOSTS = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com']);
const SHORT_LINK_HOST = 'youtu.be';
const WATCH_PATH = '/watch';
/** Розділи адреси, де id — наступний сегмент: `/shorts/{id}`, `/embed/{id}`. */
const ID_SECTIONS = new Set(['shorts', 'embed']);
const EMBED_SECTION = 'embed';

function parseHttpsUrl(url: string): URL | null {
  try {
    const parsed = new URL(url.trim());
    // Логін, пароль чи порт у посиланні YouTube не буває — таке посилання не наше
    const isPlain = !parsed.username && !parsed.password && !parsed.port;
    return parsed.protocol === 'https:' && isPlain ? parsed : null;
  } catch {
    return null;
  }
}

/** Кандидат в id за формою посилання; перевіряє формат `parseYouTubeVideoId`. */
function videoIdCandidate(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  if (url.hostname === SHORT_LINK_HOST) return segments.length === 1 ? segments[0] : null;
  if (YOUTUBE_HOSTS.has(url.hostname)) {
    if (url.pathname === WATCH_PATH) return url.searchParams.get('v');
    return segments.length === 2 && ID_SECTIONS.has(segments[0]) ? segments[1] : null;
  }
  if (YOUTUBE_NOCOOKIE_HOSTS.has(url.hostname)) {
    return segments.length === 2 && segments[0] === EMBED_SECTION ? segments[1] : null;
  }
  return null;
}

/**
 * Id відео з посилання YouTube (D54) — у формах, які копіюють редактори: `youtube.com/watch?v={id}` (і `m.`),
 * `youtu.be/{id}`, `youtube.com/shorts/{id}`, `youtube.com/embed/{id}` і `youtube-nocookie.com/embed/{id}`; лише https.
 * Решта параметрів (`t=`, `si=`, `list=`) не важить. Будь-що інше — `null`. Одна функція для API, адмінки й сайту.
 */
export function parseYouTubeVideoId(url: string): string | null {
  const parsed = parseHttpsUrl(url);
  const candidate = parsed ? videoIdCandidate(parsed) : null;
  return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

/** Канонічне посилання на відео — так його зберігає API. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Посилання YouTube у будь-якій з форм `parseYouTubeVideoId` → канонічне; інше — `null`. */
export function normalizeYouTubeUrl(url: string): string | null {
  const videoId = parseYouTubeVideoId(url);
  return videoId ? youtubeWatchUrl(videoId) : null;
}

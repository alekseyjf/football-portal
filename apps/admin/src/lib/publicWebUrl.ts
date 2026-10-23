/** Публічний web (порт 3000) — посилання з адмінки. */
export function getPublicWebUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PUBLIC_WEB_URL?.trim() || 'http://localhost:3000'
  );
}

/** Новина на сайті — `/news/{slug}-{number}` (D24), мову вибере сайт. Лише для живої: інакше — 404. */
export function publicPostUrl(post: { slug: string; number: number }): string {
  return `${getPublicWebUrl()}/news/${encodeURIComponent(post.slug)}-${post.number}`;
}

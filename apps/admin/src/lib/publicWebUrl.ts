/** Публічний web (порт 3000) — посилання з адмінки. */
export function getPublicWebUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PUBLIC_WEB_URL?.trim() || 'http://localhost:3000'
  );
}

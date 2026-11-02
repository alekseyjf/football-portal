import { serializeJsonLd, type JsonLdData } from '@/lib/seo/json-ld';

/**
 * Структуровані дані для пошуковиків (D34). Без `dangerouslySetInnerHTML`: React 19 пише текст `<script>` як є, без
 * HTML-екранування, а `<` у JSON уже екранував `serializeJsonLd`. Блок даних (`application/ld+json`) браузер не
 * виконує, і React не попереджає про `<script>` у компоненті.
 */
export function JsonLd({ data }: { data: JsonLdData }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}

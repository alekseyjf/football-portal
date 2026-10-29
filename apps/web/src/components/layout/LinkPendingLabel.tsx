'use client';

import { useLinkStatus } from 'next/link';

/**
 * Підпис посилання, що пульсує, поки сторінка, куди воно веде, рендериться на сервері: у динамічної сторінки без
 * `loading.js` перехід чекає на відповідь, і інакше клік виглядав би «мертвим». Лише прозорість — розмітка не зсувається.
 * Тільки всередині `Link`.
 */
export function LinkPendingLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className={pending ? 'animate-pulse' : undefined}>{children}</span>
  );
}

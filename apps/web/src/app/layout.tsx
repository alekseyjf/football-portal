import type { ReactNode } from 'react';

/** Кореневий layout: `html` / `body` у `app/[locale]/layout.tsx` (next-intl). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

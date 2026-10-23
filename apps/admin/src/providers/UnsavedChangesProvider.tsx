'use client';

import { createContext, useState } from 'react';
import { createUnsavedChangesGuard, type UnsavedChangesGuard } from '@/lib/unsavedChanges';

export const UnsavedChangesContext = createContext<UnsavedChangesGuard | null>(null);

/** Один сторож незбережених змін на адмінку (D50): форма блокує вихід, посилання, Cancel і «Вийти» питають. */
export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [guard] = useState(() => createUnsavedChangesGuard());
  return <UnsavedChangesContext value={guard}>{children}</UnsavedChangesContext>;
}

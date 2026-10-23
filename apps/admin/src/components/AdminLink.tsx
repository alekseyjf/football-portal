'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useLeaveGuard } from '@/hooks/useUnsavedChangesGuard';

/**
 * Посилання адмінки — `next/link`, що перед переходом питає про незбережені зміни (D50); `next/link` напряму
 * забороняє ESLint. `onNavigate` не спрацьовує на Ctrl/Cmd+клік і зовнішні адреси: нова вкладка нічого не губить.
 */
export function AdminLink({ onNavigate, ...linkProps }: ComponentProps<typeof Link>) {
  const guard = useLeaveGuard();
  return (
    <Link
      {...linkProps}
      onNavigate={(event) => {
        if (!guard.confirmLeave()) {
          event.preventDefault();
          return;
        }
        onNavigate?.(event);
      }}
    />
  );
}

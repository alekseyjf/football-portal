import { useContext, useEffect } from 'react';
import type { UnsavedChangesGuard } from '@/lib/unsavedChanges';
import { UnsavedChangesContext } from '@/providers/UnsavedChangesProvider';

/** Сторож незбережених змін: спитати перед виходом (`confirmLeave`), дозволити вихід після збереження. */
export function useLeaveGuard(): UnsavedChangesGuard {
  const guard = useContext(UnsavedChangesContext);
  if (!guard) throw new Error('useLeaveGuard: UnsavedChangesProvider is missing');
  return guard;
}

/** Форма: поки є незбережені зміни, вихід зі сторінки питає, а закриття вкладки зупиняє браузер (D50). */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean): UnsavedChangesGuard {
  const guard = useLeaveGuard();
  useEffect(() => (hasUnsavedChanges ? guard.block() : undefined), [guard, hasUnsavedChanges]);
  return guard;
}

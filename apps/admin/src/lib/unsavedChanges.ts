/**
 * Сторож незбережених змін (D50). Форма зі змінами «блокує» вихід: посилання адмінки, Cancel і «Вийти» спершу
 * питають, а закриття чи перезавантаження вкладки зупиняє браузер (`beforeunload`). Стан — у змінних, а не в
 * стані React: посилання читають його синхронно, в мить кліку, і зміна форми не перерендерює всю адмінку.
 */

const DISCARD_CHANGES_QUESTION = 'You have unsaved changes. Leave this page and discard them?';

/** Єдине місце питання: свій `<dialog>` замість `confirm` — заміна лише тут. */
function confirmDiscardChanges(): boolean {
  return window.confirm(DISCARD_CHANGES_QUESTION);
}

export interface UnsavedChangesGuard {
  /** Форма має незбережені зміни; повертає зняття блоку (cleanup ефекту) */
  block(): () => void;
  /**
   * Зміни збережено, далі — перехід (створення, видалення): вихід без питання, поки форма не заблокує вихід
   * знову. Синхронно, до `router.push`: форма ще «брудна», поки нова сторінка не відкрилась
   */
  allowLeave(): void;
  /** Чи є що втратити: форма заблокувала вихід, а зміни не збережено */
  hasUnsavedChanges(): boolean;
  /** Перед виходом зі сторінки: `true` — можна йти (змін немає або редактор погодився їх відкинути) */
  confirmLeave(): boolean;
}

interface GuardEnvironment {
  /** Де слухати `beforeunload`; без нього — `window` (у тестах — свій `EventTarget`) */
  eventTarget?: EventTarget;
  confirmDiscard?: () => boolean;
}

export function createUnsavedChangesGuard({
  eventTarget,
  confirmDiscard = confirmDiscardChanges,
}: GuardEnvironment = {}): UnsavedChangesGuard {
  let blockCount = 0;
  let isLeaveAllowed = false;
  const hasUnsavedChanges = () => blockCount > 0 && !isLeaveAllowed;
  // Браузер питає власним текстом — свій він не показує
  const stopUnload = (event: Event) => {
    if (hasUnsavedChanges()) event.preventDefault();
  };
  // `window` — лише в браузері: сторож створюється й під час SSR, а блок ставить ефект форми.
  // Слухач — лише поки є зміни: з ним браузер гірше кешує сторінку для «Назад» (bfcache)
  const unloadTarget = () => eventTarget ?? window;

  return {
    block() {
      blockCount += 1;
      isLeaveAllowed = false;
      if (blockCount === 1) unloadTarget().addEventListener('beforeunload', stopUnload);
      let isReleased = false;
      return () => {
        if (isReleased) return;
        isReleased = true;
        blockCount -= 1;
        if (blockCount === 0) unloadTarget().removeEventListener('beforeunload', stopUnload);
      };
    },
    allowLeave() {
      isLeaveAllowed = true;
    },
    hasUnsavedChanges,
    confirmLeave: () => !hasUnsavedChanges() || confirmDiscard(),
  };
}

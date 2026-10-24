import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Нативний `<dialog>` (`showModal`: фокус усередині, Esc закриває, сторінка під ним неактивна) — один на список,
 * вміст — для вибраного рядка. Вміст рендериться ще до `showModal()` (`flushSync`): фокус стає на перший елемент уже
 * вибраного рядка, а не на порожній діалог.
 */
export function useModalDialog<Item>() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [opening, setOpening] = useState<{ item: Item; key: number } | null>(null);
  return {
    dialogRef,
    /** Для чого відкрито; `null` — діалог закрито */
    item: opening?.item ?? null,
    /**
     * `key` вмісту — свій для кожного відкриття: вміст (форма, помилка запиту) щоразу починає з чистого, навіть коли
     * діалог відкрили знову раніше, ніж прийшла подія `close` попереднього відкриття (нижче)
     */
    openingKey: opening?.key ?? 0,
    open(nextItem: Item) {
      flushSync(() => setOpening((previous) => ({ item: nextItem, key: (previous?.key ?? 0) + 1 })));
      dialogRef.current?.showModal();
    },
    close() {
      dialogRef.current?.close();
    },
    /**
     * `onClose` діалогу — і після Esc: вміст прибираємо, наступне відкриття почне з чистого. Подію `close` браузер
     * шле окремим завданням: якщо діалог тим часом уже відкрили знову (Esc і одразу Enter на іншому рядку), вона
     * стосується попереднього відкриття — вміст нового не чіпаємо
     */
    handleClose() {
      if (dialogRef.current?.open) return;
      setOpening(null);
    },
  };
}

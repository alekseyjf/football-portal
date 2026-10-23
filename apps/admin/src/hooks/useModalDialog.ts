import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Нативний `<dialog>` (`showModal`: фокус усередині, Esc закриває, сторінка під ним неактивна) — один на список,
 * вміст — для вибраного рядка. Вміст рендериться ще до `showModal()` (`flushSync`): фокус стає на перший елемент уже
 * вибраного рядка, а не на порожній діалог.
 */
export function useModalDialog<Item>() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [item, setItem] = useState<Item | null>(null);
  return {
    dialogRef,
    /** Для чого відкрито; `null` — діалог закрито */
    item,
    open(nextItem: Item) {
      flushSync(() => setItem(nextItem));
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
      setItem(null);
    },
  };
}

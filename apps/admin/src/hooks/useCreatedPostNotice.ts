import { useEffect, useState } from 'react';

/**
 * Щойно створені новини — у пам'яті вкладки (D50): після створення адмінка відкриває сторінку редагування, і та
 * один раз показує «Draft created». Не в адресі (`?created=1`): перезавантаження чи скопійоване посилання
 * повідомлення не повторять.
 */
const createdPostIds = new Set<string>();

export function markPostCreated(postId: string): void {
  createdPostIds.add(postId);
}

/** Сторінка редагування: новину щойно створили — показати повідомлення, доки редактор не збереже її знову. */
export function useCreatedPostNotice(postId: string) {
  const [isShown, setIsShown] = useState(() => createdPostIds.has(postId));
  useEffect(() => {
    createdPostIds.delete(postId);
  }, [postId]);
  return { isShown, hide: () => setIsShown(false) };
}

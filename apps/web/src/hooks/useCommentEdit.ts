import { useCallback, useRef, useState } from 'react';
import type { CommentItem } from '@/lib/api/types';
import { useEditComment } from './useComments';

/**
 * Зміна свого коментаря на місці (M1.7.4): форма замість тексту, збережений текст — з відповіді API в кеші порції.
 * Форму закрили — фокус знову на «Редагувати», з якої її відкрили (як «Скасувати» у відповіді).
 */
export function useCommentEdit(postId: string, comment: CommentItem) {
  const { mutateAsync: editComment } = useEditComment(postId);
  const [isEditing, setIsEditing] = useState(false);
  // Кнопка зникає разом з текстом, поки відкрита форма, — фокус їй повертає ref, коли вона знову з'явиться
  const shouldFocusEditButton = useRef(false);

  const attachEditButton = useCallback((element: HTMLButtonElement | null) => {
    if (!element || !shouldFocusEditButton.current) return;
    shouldFocusEditButton.current = false;
    element.focus();
  }, []);

  function closeEditor() {
    shouldFocusEditButton.current = true;
    setIsEditing(false);
  }

  /** Відхилений проміс — помилка API під полем, форма лишається відкритою */
  async function saveEdit(content: string) {
    await editComment({ comment, content });
    closeEditor();
  }

  return {
    isEditing,
    openEditor: () => setIsEditing(true),
    cancelEditor: closeEditor,
    saveEdit,
    attachEditButton,
  };
}

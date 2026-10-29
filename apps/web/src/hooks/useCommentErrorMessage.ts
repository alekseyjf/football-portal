import { useTranslations } from 'next-intl';
import { isApiError } from '@/lib/api/http';

/** Коди помилок `POST /comments` і `PATCH /comments/{id}`, які варто показати користувачу (решта — без тексту). */
export function useCommentErrorMessage() {
  const t = useTranslations('comments');
  return (error: unknown): string | null => {
    if (!isApiError(error)) return null;
    switch (error.code) {
      case 'COMMENT_COOLDOWN':
        return t('cooldown');
      case 'COMMENTS_SUSPENDED':
        return t('commentsSuspended');
      case 'ACCOUNT_LOCKED':
        return t('accountLocked');
      case 'COMMENT_THREAD_LOCKED':
        return t('threadLocked');
      case 'PARENT_COMMENT_NOT_FOUND':
        return t('parentDeleted');
      // Годинник читача відстав — кнопка ще була, а 15 хв на сервері вже минули (M1.7.4)
      case 'COMMENT_EDIT_WINDOW_CLOSED':
        return t('editWindowClosed');
      case 'COMMENT_NOT_FOUND':
        return t('commentGone');
      default:
        return null;
    }
  };
}

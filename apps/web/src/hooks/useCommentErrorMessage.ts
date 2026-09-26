import { useTranslations } from 'next-intl';
import { isApiError } from '@/lib/api/http';

/** Коди помилок `POST /comments`, які варто показати користувачу (решта — без тексту). */
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
      case 'COMMENT_DEPTH_EXCEEDED':
        return t('depthExceeded');
      default:
        return null;
    }
  };
}

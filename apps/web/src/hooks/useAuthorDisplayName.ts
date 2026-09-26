import { useTranslations } from 'next-intl';
import type { PublicAuthor } from '@/lib/api/types';

/** Ім'я автора для UI: видалений акаунт — локалізований підпис, а не ім'я з БД. */
export function useAuthorDisplayName() {
  const t = useTranslations('users');
  return (author: PublicAuthor) =>
    author.isDeleted ? t('deletedUser') : author.name;
}

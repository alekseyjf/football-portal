/**
 * Автор поста чи коментаря — без email і дат. Видалений акаунт: `isDeleted: true`, `name` — «Deleted user»
 * (підпис мовою інтерфейсу показує клієнт за `isDeleted`).
 */
export class PublicAuthorDto {
  id!: string;
  /** Ім'я з профілю */
  name!: string;
  avatarUrl!: string | null;
  isDeleted!: boolean;
}

/** Відповідь-підтвердження без даних: вихід, refresh, видалення акаунта. */
export class MessageResponseDto {
  /** Текст для людини (`Logged out successfully`); клієнт на нього не спирається */
  message!: string;
}

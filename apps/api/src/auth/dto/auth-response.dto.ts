import { MessageResponseDto } from '../../common/dto/message-response.dto';
import { UserAccountDto } from '../../users/dto/user-account-response.dto';

/** `register`, `login`, `login/admin`: створений або залогінений користувач. */
export class AuthUserResponseDto extends MessageResponseDto {
  user!: UserAccountDto;
}

/** `GET /auth/me` — відновлення сесії після F5. */
export class CurrentUserResponseDto {
  /** `null` — гість: ні живого access-токена, ні refresh-cookie */
  user!: UserAccountDto | null;
}

/** `POST /auth/logout-all` */
export class LogoutAllResponseDto extends MessageResponseDto {
  /** Скільки сесій (пристроїв) завершено, разом із поточною */
  revokedSessions!: number;
}

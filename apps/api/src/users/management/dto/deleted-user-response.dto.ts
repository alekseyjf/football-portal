import { MessageResponseDto } from '../../../common/dto/message-response.dto';

/** `DELETE /users/:id` (ADMIN): акаунт анонімізовано. */
export class DeletedUserDto extends MessageResponseDto {
  userId!: string;
}

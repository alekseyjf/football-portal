import { ApiProperty } from '@nestjs/swagger';
import { LikeType } from '@prisma/client';
import { PublicAuthorDto } from '../../users/dto/public-author-response.dto';

/** Кому відповіли: відповідь на відповідь (як «@Ім'я» на YouTube). */
export class CommentReplyToDto {
  /** Відповідь, на яку відповіли; `null` — її фізично видалив адмін */
  commentId!: string | null;
  /** Її автор («@Ім'я» — з профілю, тож перейменування оновлює згадку); `null` — акаунта в базі немає */
  author!: PublicAuthorDto | null;
}

/**
 * Коментар порції: корінь або відповідь у гілці — один рівень, як на YouTube.
 * Заглушка — видалений корінь, під яким лишились відповіді: `isDeleted`, текст і автор — `null`.
 */
export class CommentItemDto {
  id!: string;
  /** Корінь гілки, під яким відповідь; `null` — сам корінь */
  parentId!: string | null;
  /** `null` — заглушка */
  content!: string | null;
  /** `null` — заглушка */
  author!: PublicAuthorDto | null;
  /** Заглушка «Коментар видалено» */
  isDeleted!: boolean;
  createdAt!: Date;
  /** Коли автор змінив текст; `null` — не змінював */
  editedAt!: Date | null;
  likeCount!: number;

  /** Мій голос; `null` — не голосував або гість */
  @ApiProperty({ enum: LikeType, enumName: 'LikeType', nullable: true })
  myReaction!: LikeType | null;

  /** Живі відповіді під коренем; у відповіді — 0 */
  replyCount!: number;
  /** Кому відповіли; `null` — корінь або відповідь на корінь */
  replyTo!: CommentReplyToDto | null;
}

/** Порція відповідей гілки `GET /comments/{id}/replies` (і основа порції коренів). */
export class CommentPageDto {
  items!: CommentItemDto[];
  /** Курсор наступної порції — як є в `?cursor=`; `null` — порцій більше немає */
  nextCursor!: string | null;
}

/** Порція коренів `GET /comments` — з лічильником новини чи матчу. */
export class CommentRootsPageDto extends CommentPageDto {
  /** «N коментарів»: живі корені й відповіді, разом із відповідями під заглушкою; сама заглушка — ні */
  commentCount!: number;
}

/** `DELETE /comments/{id}`: коментар сховано (корінь з відповідями — заглушка). */
export class SoftDeletedCommentDto {
  id!: string;
}

/** `DELETE /comments/{id}/purge`, `…/purge-thread`: коментар фізично видалено з БД. */
export class PurgedCommentDto {
  id!: string;
  /** Скільки рядків видалено, разом із цим */
  purgedCount!: number;
}

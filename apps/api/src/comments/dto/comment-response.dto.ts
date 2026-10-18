import { PublicAuthorDto } from '../../users/dto/public-author-response.dto';

/**
 * Коментар з відповідями. У дереві корені — закріплені першими, далі новіші; відповіді — хронологічно.
 * Видалених немає: з коментарем ховається вся гілка відповідей під ним.
 */
export class CommentDto {
  id!: string;
  content!: string;
  /** Коли закріплено; `null` — не закріплено */
  pinnedAt!: Date | null;
  createdAt!: Date;
  /** `null` — коментар верхнього рівня */
  parentId!: string | null;
  author!: PublicAuthorDto;
  replies!: CommentDto[];
}

/** `DELETE /comments/{id}`: коментар сховано разом з гілкою відповідей. */
export class SoftDeletedCommentDto {
  id!: string;
  /** Скільки коментарів сховано, разом із цим */
  deletedCount!: number;
}

/** `DELETE /comments/{id}/purge`, `…/purge-thread`: коментар фізично видалено з БД. */
export class PurgedCommentDto {
  id!: string;
  /** Скільки рядків видалено, разом із цим */
  purgedCount!: number;
}

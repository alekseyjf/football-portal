import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  commentEditWindowStart,
  isCommentEditWindowOpen,
} from '@football-portal/validation';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CommentAntiAbuseService } from './comment-anti-abuse.service';
import { toCommentItem } from './comment-response';
import {
  CommentRepository,
  type CommentEditRow,
  type CommentItemRow,
} from './comment.repository';
import type { CommentItemDto } from './dto/comment-response.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

type CommentEditor = { userId: string; isAdmin: boolean };

/**
 * Змінити текст може лише автор і лише 15 хв (D27). Адмін чужий не змінює — лише видаляє: текст під іменем автора
 * має бути його. Закритий тред — як для нового коментаря: адміну можна.
 */
function assertCommentEditable(
  comment: CommentEditRow | null,
  editor: CommentEditor,
  now: Date,
): asserts comment is CommentEditRow {
  if (!comment || comment.deletedAt) {
    throw new NotFoundException('COMMENT_NOT_FOUND');
  }
  if (comment.authorId !== editor.userId) {
    throw new ForbiddenException('COMMENT_EDIT_FORBIDDEN');
  }
  if (!isCommentEditWindowOpen(comment.createdAt, now)) {
    throw new ForbiddenException('COMMENT_EDIT_WINDOW_CLOSED');
  }
  if (comment.thread.isLocked && !editor.isAdmin) {
    throw new ForbiddenException('COMMENT_THREAD_LOCKED');
  }
}

/** Зміна тексту свого коментаря протягом 15 хв від публікації (D27, M1.7.4). */
@Injectable()
export class CommentEditService {
  constructor(
    private commentRepository: CommentRepository,
    private commentAntiAbuse: CommentAntiAbuseService,
    private prisma: PrismaService,
  ) {}

  /**
   * Текст — ті самі межі, що в нового (DTO), бан на коментарі — теж; пауза між коментарями й burst — ні: одруківку
   * виправляють одразу, а правки обмежують вікно й «лише своє» (👤 M1.7.4). Той самий текст — успіх без «(змінено)».
   */
  async editComment(
    id: string,
    dto: UpdateCommentDto,
    user: AuthenticatedUser,
  ): Promise<CommentItemDto> {
    const editor = { userId: user.id, isAdmin: user.role === Role.ADMIN };
    // Одна мить для перевірки й умови запису: відмова після гонки — та сама, що й без неї
    const now = new Date();
    const comment = await this.commentRepository.findForEdit(id);
    assertCommentEditable(comment, editor, now);
    await this.commentAntiAbuse.assertNotSuspendedOrThrow(
      editor.userId,
      editor.isAdmin,
    );

    const [itemRow, reactions] = await Promise.all([
      comment.content === dto.content
        ? this.commentRepository.findItem(id)
        : this.saveContent(id, dto.content, editor, now),
      this.commentRepository.findUserReactions(editor.userId, [id]),
    ]);
    // Між читаннями коментар purge-нули
    if (!itemRow) throw new NotFoundException('COMMENT_NOT_FOUND');
    return toCommentItem(itemRow, reactions.get(id) ?? null);
  }

  /**
   * Запис і читання — одна транзакція: видалення, що прийшло слідом, чекає на неї, тож у відповіді — збережений
   * текст, а не заглушка. Видалення, що встигло першим, перемагає — правка отримує 404.
   */
  private async saveContent(
    id: string,
    content: string,
    editor: CommentEditor,
    now: Date,
  ): Promise<CommentItemRow | null> {
    const savedRow = await this.prisma.$transaction(async (tx) => {
      const isSaved = await this.commentRepository.updateContentIfEditable(tx, {
        commentId: id,
        authorId: editor.userId,
        content,
        editedAt: now,
        createdAfter: commentEditWindowStart(now),
      });
      return isSaved ? this.commentRepository.findItem(id, tx) : null;
    });
    if (savedRow) return savedRow;
    // Між перевіркою й записом коментар видалили — та сама відповідь, що дав би запит після видалення
    assertCommentEditable(
      await this.commentRepository.findForEdit(id),
      editor,
      now,
    );
    throw new NotFoundException('COMMENT_NOT_FOUND');
  }
}

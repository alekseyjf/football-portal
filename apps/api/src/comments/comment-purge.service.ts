import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  isForeignKeyViolation,
  isTransientTransactionError,
} from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { COMMENT_THREAD_CHANGED } from './comment-errors';
import { CommentThreadRepository } from './comment-thread.repository';
import {
  CommentRepository,
  type CommentModerationRow,
  type LockedComment,
} from './comment.repository';
import type { PurgedCommentDto } from './dto/comment-response.dto';

/**
 * ADMIN: фізичне видалення (legal / GDPR, D20). Один рівень (D27): відповідь — завжди «листок», гілка — корінь
 * і відповіді за `rootId`. Адресати, що вели на видалені рядки, обнуляє БД (`ON DELETE SET NULL`).
 */
@Injectable()
export class CommentPurgeService {
  constructor(
    private commentRepository: CommentRepository,
    private threadRepository: CommentThreadRepository,
    private prisma: PrismaService,
  ) {}

  /** Коментар без жодної відповіді — живої чи soft-видаленої (P4-6). */
  async purgeComment(id: string): Promise<PurgedCommentDto> {
    const comment = await this.findForPurgeOrThrow(id);
    try {
      await this.prisma.$transaction(async (tx) => {
        const lockedTarget = await this.lockForPurge(tx, comment);
        const isPurged = await this.commentRepository.purgeIfNoReplies(tx, id);
        if (!isPurged) throw new ConflictException('COMMENT_HAS_REPLIES');
        await this.decrementCountersAfterPurge(tx, comment, [lockedTarget]);
      });
    } catch (error) {
      // Відповідь з'явилась між перевіркою і DELETE → FK
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('COMMENT_HAS_REPLIES');
      }
      if (isTransientTransactionError(error)) {
        throw new ConflictException(COMMENT_THREAD_CHANGED);
      }
      throw error;
    }
    return { id, purgedCount: 1 };
  }

  /** Корінь — разом з усіма відповідями гілки; відповідь — лише вона (P4-7). */
  async purgeCommentThread(id: string): Promise<PurgedCommentDto> {
    const comment = await this.findForPurgeOrThrow(id);
    try {
      const purgedCount = await this.prisma.$transaction(async (tx) => {
        const lockedTarget = await this.lockForPurge(tx, comment);
        // Під блокуванням кореня нова відповідь у гілку не вставиться (вставка спершу оновлює корінь),
        // тож список відповідей повний
        const replyIds =
          comment.rootId === null
            ? await this.commentRepository.findReplyIds(tx, id)
            : [];
        const lockedReplies = await this.commentRepository.lockForWrite(
          tx,
          replyIds,
        );
        // Відповіді першими: `Restrict` на `parentId` / `rootId` не дає видалити корінь раніше
        const purgedReplies = await this.commentRepository.purgeByIds(
          tx,
          replyIds,
        );
        const purgedTarget = await this.commentRepository.purgeByIds(tx, [id]);
        // Живість — зі стану під блокуванням: паралельний soft delete міг закомітитися після читання
        // й уже відняв свій рядок (інакше — подвійний декремент)
        await this.decrementCountersAfterPurge(tx, comment, [
          lockedTarget,
          ...lockedReplies,
        ]);
        return purgedReplies + purgedTarget;
      });
      return { id, purgedCount };
    } catch (error) {
      // Гонка, яку блокування не відсікли (FK чи deadlock), — стан змінився, адмін повторює
      if (isForeignKeyViolation(error) || isTransientTransactionError(error)) {
        throw new ConflictException(COMMENT_THREAD_CHANGED);
      }
      throw error;
    }
  }

  /** Purge дозволений і для вже soft-видаленого коментаря. */
  private async findForPurgeOrThrow(id: string): Promise<CommentModerationRow> {
    const comment = await this.commentRepository.findForModeration(id);
    if (!comment) throw new NotFoundException('COMMENT_NOT_FOUND');
    return comment;
  }

  /**
   * Блокує корінь гілки, потім ціль — той самий порядок, що в create і soft delete, тож паралельні
   * записи однієї гілки не зациклюються. Повертає стан цілі під блокуванням.
   */
  private async lockForPurge(
    tx: Prisma.TransactionClient,
    comment: CommentModerationRow,
  ): Promise<LockedComment> {
    if (comment.rootId) {
      await this.commentRepository.lockForWrite(tx, [comment.rootId]);
    }
    const [lockedTarget] = await this.commentRepository.lockForWrite(tx, [
      comment.id,
    ]);
    if (!lockedTarget) throw new NotFoundException('COMMENT_NOT_FOUND');
    return lockedTarget;
  }

  /** Живі серед видалених — мінус з лічильника треду; жива відповідь — ще й мінус відповідь кореня. */
  private async decrementCountersAfterPurge(
    tx: Prisma.TransactionClient,
    comment: CommentModerationRow,
    purgedComments: LockedComment[],
  ): Promise<void> {
    const purgedLiveCount = purgedComments.filter(
      (purged) => purged.deletedAt === null,
    ).length;
    if (purgedLiveCount > 0) {
      await this.threadRepository.changeCommentCount(
        tx,
        comment.threadId,
        -purgedLiveCount,
      );
    }
    const wasTargetLive = purgedComments.some(
      (purged) => purged.id === comment.id && purged.deletedAt === null,
    );
    if (wasTargetLive && comment.rootId) {
      await this.commentRepository.changeReplyCount(tx, comment.rootId, -1);
    }
  }
}

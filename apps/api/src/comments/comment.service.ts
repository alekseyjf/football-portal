import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, type Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  isForeignKeyViolation,
  isTransientTransactionError,
  isUniqueViolationOn,
} from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CommentAntiAbuseService } from './comment-anti-abuse.service';
import {
  toPublicComment,
  type PurgedComment,
  type SoftDeletedComment,
} from './comment-response';
import { collectCommentSubtree } from './comment-subtree';
import { MAX_COMMENT_THREAD_DEPTH } from './comment-thread.constants';
import {
  CommentThreadRepository,
  type CommentTargetState,
  type ThreadState,
} from './comment-thread.repository';
import {
  buildCommentTreeFromFlat,
  type PublicCommentNode,
} from './comment-thread.util';
import {
  CommentRepository,
  type CommentModerationRow,
  type LockedComment,
} from './comment.repository';
import { CreateCommentDto } from './dto/create-comment.dto';

type CommentTargetRef =
  | { kind: 'post'; postId: string }
  | { kind: 'match'; matchId: string };

type CommentTarget = CommentTargetRef & { thread: ThreadState | null };

/** Положення нової відповіді в гілці (P4-2). */
type ReplyPlacement = {
  parentId: string;
  threadId: string;
  rootId: string;
  depth: number;
};

/** Транзакцію відкочено через паралельний запис у тому ж піддереві — повтор безпечний. */
const COMMENT_THREAD_CHANGED = 'COMMENT_THREAD_CHANGED';

/**
 * Спроби транзакції створення: другий шанс — якщо тред щойно створив паралельний перший
 * коментар (`upsert` у Prisma 7 з driver adapter — SELECT + INSERT, а не `ON CONFLICT`,
 * після коміту суперника повтор знаходить тред) або транзакцію обрано жертвою deadlock-у.
 */
const INSERT_COMMENT_ATTEMPTS = 2;

/**
 * Рівно одна ціль (P4-1). `null` = не передано: `@IsOptional` пропускає `null` без валідації
 * (так само, як `publishedAt: null` у постах).
 */
function readTargetRef(dto: CreateCommentDto): CommentTargetRef {
  const postId = dto.postId ?? null;
  const matchId = dto.matchId ?? null;
  if (postId !== null && matchId === null) return { kind: 'post', postId };
  if (matchId !== null && postId === null) return { kind: 'match', matchId };
  throw new BadRequestException('COMMENT_TARGET_INVALID');
}

/** Батько — живий і в треді цілі; глибина — з батька (P4-2). */
function placeReply(
  parentId: string,
  parent: CommentModerationRow | null,
  targetThread: ThreadState | null,
): ReplyPlacement {
  if (!parent || parent.deletedAt) {
    throw new NotFoundException('PARENT_COMMENT_NOT_FOUND');
  }
  // У цілі ще немає треду → батько точно з іншого
  if (parent.threadId !== targetThread?.id) {
    throw new BadRequestException('PARENT_COMMENT_MISMATCH');
  }
  const depth = parent.depth + 1;
  if (depth > MAX_COMMENT_THREAD_DEPTH) {
    throw new BadRequestException('COMMENT_DEPTH_EXCEEDED');
  }
  return {
    parentId,
    threadId: parent.threadId,
    rootId: parent.rootId ?? parent.id,
    depth,
  };
}

function isInsertRetryable(error: unknown): boolean {
  return (
    isUniqueViolationOn(error, 'CommentThread') ||
    isTransientTransactionError(error)
  );
}

@Injectable()
export class CommentService {
  constructor(
    private commentRepository: CommentRepository,
    private threadRepository: CommentThreadRepository,
    private commentAntiAbuse: CommentAntiAbuseService,
    private prisma: PrismaService,
  ) {}

  /** Неживий пост → 404 (P4-1); живий без жодного коментаря → `[]`. */
  async getCommentsByPost(postId: string): Promise<PublicCommentNode[]> {
    const target = await this.threadRepository.findLivePostTarget(
      postId,
      new Date(),
    );
    if (!target) throw new NotFoundException('POST_NOT_FOUND');
    return this.buildThreadTree(target);
  }

  async getCommentsByMatch(matchId: string): Promise<PublicCommentNode[]> {
    const target = await this.threadRepository.findMatchTarget(matchId);
    if (!target) throw new NotFoundException('MATCH_NOT_FOUND');
    return this.buildThreadTree(target);
  }

  async createComment(
    dto: CreateCommentDto,
    user: AuthenticatedUser,
  ): Promise<PublicCommentNode> {
    const isAdmin = user.role === Role.ADMIN;
    const targetRef = readTargetRef(dto);
    const parentId = dto.parentId ?? null;
    // Ціль і батько — незалежні читання
    const [target, parent] = await Promise.all([
      this.loadTarget(targetRef),
      parentId
        ? this.commentRepository.findForModeration(parentId)
        : Promise.resolve(null),
    ]);
    // До перевірки батька й до анти-абузу: закритий тред → 403 і не рахується як спроба (P4-3)
    if (target.thread?.isLocked && !isAdmin) {
      throw new ForbiddenException('COMMENT_THREAD_LOCKED');
    }
    const reply = parentId ? placeReply(parentId, parent, target.thread) : null;

    await this.commentAntiAbuse.assertCanCommentOrThrow(user.id, isAdmin);
    await this.commentAntiAbuse.recordCommentAttemptAndEnforceBurstOrThrow(
      user.id,
      isAdmin,
    );

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.insertComment(dto.content, user, target, reply);
      } catch (error) {
        if (attempt < INSERT_COMMENT_ATTEMPTS && isInsertRetryable(error)) {
          continue;
        }
        if (isTransientTransactionError(error)) {
          throw new ConflictException(COMMENT_THREAD_CHANGED);
        }
        throw error;
      }
    }
  }

  /** Soft delete коментаря разом з усією гілкою відповідей під ним (P4-5). */
  async deleteComment(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SoftDeletedComment> {
    const comment = await this.commentRepository.findForModeration(id);
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('COMMENT_NOT_FOUND');
    }
    const isAuthor = comment.authorId === user.id;
    if (!isAuthor && user.role !== Role.ADMIN) {
      throw new ForbiddenException('COMMENT_DELETE_FORBIDDEN');
    }

    try {
      const deletedCount = await this.prisma.$transaction(async (tx) => {
        // Батько блокується першим (UPDATE), ціль — другою: той самий порядок, що в create / purge
        if (comment.parentId) {
          await this.commentRepository.changeReplyCount(
            tx,
            comment.parentId,
            -1,
          );
        }
        const deletedAt = new Date();
        const isTargetDeleted = await this.commentRepository.softDeleteIfLive(
          tx,
          id,
          deletedAt,
        );
        // Паралельний delete / purge встиг першим — декремент батька відкочується
        if (!isTargetDeleted) throw new NotFoundException('COMMENT_NOT_FOUND');

        // По рівнях: відповідь, закомічена до нашого UPDATE рівня, потрапить у наступний
        let deletedTotal = 1;
        let levelIds = [id];
        while (levelIds.length > 0) {
          levelIds = await this.commentRepository.softDeleteLiveRepliesOf(
            tx,
            levelIds,
            deletedAt,
          );
          deletedTotal += levelIds.length;
        }

        await this.threadRepository.changeCommentCount(
          tx,
          comment.threadId,
          -deletedTotal,
        );
        return deletedTotal;
      });
      return { id, deletedCount };
    } catch (error) {
      if (isTransientTransactionError(error)) {
        throw new ConflictException(COMMENT_THREAD_CHANGED);
      }
      throw error;
    }
  }

  /** ADMIN: фізичне видалення коментаря без жодної відповіді (P4-6, розділ 7.5.2). */
  async purgeComment(id: string): Promise<PurgedComment> {
    const comment = await this.findForPurgeOrThrow(id);
    try {
      await this.prisma.$transaction(async (tx) => {
        const { lockedTarget } = await this.lockForPurge(tx, comment, [id]);
        const isPurged = await this.commentRepository.purgeIfNoReplies(tx, id);
        if (!isPurged) throw new ConflictException('COMMENT_HAS_REPLIES');
        const wasTargetLive = lockedTarget.deletedAt === null;
        await this.decrementCountersAfterPurge(tx, comment, {
          wasTargetLive,
          purgedLiveCount: wasTargetLive ? 1 : 0,
        });
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

  /** ADMIN: фізичне видалення коментаря з усім піддеревом відповідей (P4-7). */
  async purgeCommentThread(id: string): Promise<PurgedComment> {
    const comment = await this.findForPurgeOrThrow(id);
    try {
      const purgedCount = await this.prisma.$transaction(async (tx) => {
        const branch = await this.commentRepository.findBranch(
          tx,
          comment.rootId ?? comment.id,
        );
        const subtree = collectCommentSubtree(branch, id);
        if (!subtree) throw new NotFoundException('COMMENT_NOT_FOUND');
        const { lockedTarget, lockedComments } = await this.lockForPurge(
          tx,
          comment,
          subtree.commentIds,
        );

        // Найглибші першими: на момент видалення батька його дітей уже немає (Restrict)
        let purgedTotal = 0;
        for (const levelIds of subtree.levelsDeepestFirst) {
          purgedTotal += await this.commentRepository.purgeByIds(tx, levelIds);
        }
        // Живість — зі стану під блокуванням, а не з читання гілки: паралельний soft delete
        // нащадка міг закомітитися між ними й уже відняв свої рядки (інакше — подвійний декремент)
        await this.decrementCountersAfterPurge(tx, comment, {
          wasTargetLive: lockedTarget.deletedAt === null,
          purgedLiveCount: lockedComments.filter(
            (locked) => locked.deletedAt === null,
          ).length,
        });
        return purgedTotal;
      });
      return { id, purgedCount };
    } catch (error) {
      // Нова відповідь у піддереві (FK) або deadlock — стан змінився, адмін повторює
      if (isForeignKeyViolation(error) || isTransientTransactionError(error)) {
        throw new ConflictException(COMMENT_THREAD_CHANGED);
      }
      throw error;
    }
  }

  /** Тред створюється разом з першим коментарем (P4-1); лічильники — в тій самій транзакції (P4-4). */
  private insertComment(
    content: string,
    user: AuthenticatedUser,
    target: CommentTarget,
    reply: ReplyPlacement | null,
  ): Promise<PublicCommentNode> {
    const isAdmin = user.role === Role.ADMIN;
    // Порядок блокувань — батько → тред, як і в delete: без deadlock-ів між ними
    return this.prisma.$transaction(async (tx) => {
      let threadId: string;
      if (reply) {
        const isParentLive =
          await this.commentRepository.incrementReplyCountIfLive(
            tx,
            reply.parentId,
            reply.threadId,
          );
        if (!isParentLive) {
          throw new NotFoundException('PARENT_COMMENT_NOT_FOUND');
        }
        threadId = reply.threadId;
      } else {
        const thread =
          target.kind === 'post'
            ? await this.threadRepository.getOrCreateForPost(tx, target.postId)
            : await this.threadRepository.getOrCreateForMatch(
                tx,
                target.matchId,
              );
        threadId = thread.id;
      }

      const createdComment = await this.commentRepository.insert(tx, {
        threadId,
        authorId: user.id,
        content,
        parentId: reply?.parentId ?? null,
        rootId: reply?.rootId ?? null,
        depth: reply?.depth ?? 0,
      });
      const threadAfter = await this.threadRepository.changeCommentCount(
        tx,
        threadId,
        1,
      );
      // Тред закрили між перевіркою і записом → відкат транзакції (P4-3)
      if (threadAfter.isLocked && !isAdmin) {
        throw new ForbiddenException('COMMENT_THREAD_LOCKED');
      }
      return { ...toPublicComment(createdComment), replies: [] };
    });
  }

  private async buildThreadTree(
    target: CommentTargetState,
  ): Promise<PublicCommentNode[]> {
    if (!target.thread) return [];
    const comments = await this.commentRepository.findLiveInThread(
      target.thread.id,
    );
    return buildCommentTreeFromFlat(comments.map(toPublicComment));
  }

  /** Пост — живий, матч — існує (P4-1). */
  private async loadTarget(
    targetRef: CommentTargetRef,
  ): Promise<CommentTarget> {
    if (targetRef.kind === 'post') {
      const state = await this.threadRepository.findLivePostTarget(
        targetRef.postId,
        new Date(),
      );
      if (!state) throw new NotFoundException('POST_NOT_FOUND');
      return { ...targetRef, thread: state.thread };
    }
    const state = await this.threadRepository.findMatchTarget(
      targetRef.matchId,
    );
    if (!state) throw new NotFoundException('MATCH_NOT_FOUND');
    return { ...targetRef, thread: state.thread };
  }

  /** Purge дозволений і для вже soft-видаленого коментаря. */
  private async findForPurgeOrThrow(id: string): Promise<CommentModerationRow> {
    const comment = await this.commentRepository.findForModeration(id);
    if (!comment) throw new NotFoundException('COMMENT_NOT_FOUND');
    return comment;
  }

  /**
   * Блокує батька, потім ціль з піддеревом (від предків до нащадків) — той самий порядок,
   * що в soft delete, тож паралельні delete / purge однієї гілки не зациклюються.
   * Повертає стан рядків під блокуванням.
   */
  private async lockForPurge(
    tx: Prisma.TransactionClient,
    comment: CommentModerationRow,
    commentIds: string[],
  ): Promise<{ lockedTarget: LockedComment; lockedComments: LockedComment[] }> {
    if (comment.parentId) {
      await this.commentRepository.lockForWrite(tx, [comment.parentId]);
    }
    const lockedComments = await this.commentRepository.lockForWrite(
      tx,
      commentIds,
    );
    const lockedTarget = lockedComments.find(
      (locked) => locked.id === comment.id,
    );
    if (!lockedTarget) throw new NotFoundException('COMMENT_NOT_FOUND');
    return { lockedTarget, lockedComments };
  }

  private async decrementCountersAfterPurge(
    tx: Prisma.TransactionClient,
    comment: CommentModerationRow,
    purged: { wasTargetLive: boolean; purgedLiveCount: number },
  ): Promise<void> {
    if (purged.purgedLiveCount > 0) {
      await this.threadRepository.changeCommentCount(
        tx,
        comment.threadId,
        -purged.purgedLiveCount,
      );
    }
    if (purged.wasTargetLive && comment.parentId) {
      await this.commentRepository.changeReplyCount(tx, comment.parentId, -1);
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  isForeignKeyViolation,
  isTransientTransactionError,
  isUniqueViolationOn,
} from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CommentAntiAbuseService } from './comment-anti-abuse.service';
import { COMMENT_THREAD_CHANGED } from './comment-errors';
import { toCommentItem } from './comment-response';
import { readCommentTargetRef, type CommentTargetRef } from './comment-target';
import {
  CommentThreadRepository,
  type ThreadState,
} from './comment-thread.repository';
import {
  CommentRepository,
  type CommentModerationRow,
  type NewCommentRow,
} from './comment.repository';
import type {
  CommentItemDto,
  SoftDeletedCommentDto,
} from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

type CommentTarget = CommentTargetRef & { thread: ThreadState | null };

/** Відповідь у гілці (D27): тред батька й корінь з адресатом. */
type ReplyPlacement = {
  threadId: string;
  branch: NonNullable<NewCommentRow['branch']>;
};

/**
 * Спроби транзакції створення: другий шанс — якщо тред щойно створив паралельний перший
 * коментар (`upsert` у Prisma 7 з driver adapter — SELECT + INSERT, а не `ON CONFLICT`,
 * після коміту суперника повтор знаходить тред) або транзакцію обрано жертвою deadlock-у.
 */
const INSERT_COMMENT_ATTEMPTS = 2;

/**
 * Один рівень, як на YouTube (D27): відповідь — завжди під коренем гілки. Відповідь на корінь — без адресата;
 * на відповідь (і від старого клієнта з деревом) — у ту саму гілку, з відповіддю й автором, кому відповіли.
 * Батько — живий і в треді цілі (P4-2).
 */
function placeReply(
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
  if (parent.rootId === null) {
    return {
      threadId: parent.threadId,
      branch: {
        rootId: parent.id,
        replyToCommentId: null,
        replyToUserId: null,
      },
    };
  }
  return {
    threadId: parent.threadId,
    branch: {
      rootId: parent.rootId,
      replyToCommentId: parent.id,
      replyToUserId: parent.authorId,
    },
  };
}

function isInsertRetryable(error: unknown): boolean {
  return (
    isUniqueViolationOn(error, 'CommentThread') ||
    isTransientTransactionError(error)
  );
}

/** Запис коментарів: створення й видалення автором або адміном. */
@Injectable()
export class CommentService {
  constructor(
    private commentRepository: CommentRepository,
    private threadRepository: CommentThreadRepository,
    private commentAntiAbuse: CommentAntiAbuseService,
    private prisma: PrismaService,
  ) {}

  async createComment(
    dto: CreateCommentDto,
    user: AuthenticatedUser,
  ): Promise<CommentItemDto> {
    const isAdmin = user.role === Role.ADMIN;
    const targetRef = readCommentTargetRef(dto);
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
    const reply = parentId ? placeReply(parent, target.thread) : null;

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
        // Відповідь, кому відповіли, purge-нули між читанням батька і вставкою (FK `replyToCommentId`)
        if (reply && isForeignKeyViolation(error)) {
          throw new NotFoundException('PARENT_COMMENT_NOT_FOUND');
        }
        if (isTransientTransactionError(error)) {
          throw new ConflictException(COMMENT_THREAD_CHANGED);
        }
        throw error;
      }
    }
  }

  /**
   * Soft delete (D27): відповідь — зникає, інші відповіді гілки лишаються; корінь з живими відповідями стає
   * заглушкою (похідний стан — `listedRootWhere`), без відповідей — зникає.
   */
  async deleteComment(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SoftDeletedCommentDto> {
    const comment = await this.commentRepository.findForModeration(id);
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('COMMENT_NOT_FOUND');
    }
    const isAuthor = comment.authorId === user.id;
    if (!isAuthor && user.role !== Role.ADMIN) {
      throw new ForbiddenException('COMMENT_DELETE_FORBIDDEN');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Корінь гілки блокується першим (UPDATE), ціль — другою: той самий порядок, що в create / purge
        if (comment.rootId) {
          await this.commentRepository.changeReplyCount(tx, comment.rootId, -1);
        }
        const isTargetDeleted = await this.commentRepository.softDeleteIfLive(
          tx,
          id,
          new Date(),
        );
        // Паралельний delete / purge встиг першим — декремент кореня відкочується
        if (!isTargetDeleted) throw new NotFoundException('COMMENT_NOT_FOUND');
        await this.threadRepository.changeCommentCount(
          tx,
          comment.threadId,
          -1,
        );
      });
      return { id };
    } catch (error) {
      if (isTransientTransactionError(error)) {
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
  ): Promise<CommentItemDto> {
    const isAdmin = user.role === Role.ADMIN;
    // Порядок блокувань — корінь → тред, як і в delete: без deadlock-ів між ними
    return this.prisma.$transaction(async (tx) => {
      let threadId: string;
      if (reply) {
        const isBranchOpen =
          await this.commentRepository.incrementReplyCountIfBranchOpen(
            tx,
            reply.branch.rootId,
            reply.threadId,
          );
        if (!isBranchOpen) {
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
        branch: reply?.branch ?? null,
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
      // Щойно створений — ще без голосів
      return toCommentItem(createdComment, null);
    });
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
}

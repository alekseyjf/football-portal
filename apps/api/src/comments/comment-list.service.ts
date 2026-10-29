import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LikeType } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { LanguageService } from '../languages/language.service';
import type { PublicPostScope } from '../posts/post-visibility';
import {
  decodeCommentCursor,
  encodeCommentCursor,
  type CommentCursorContext,
  type CommentPagePosition,
} from './comment-cursor';
import { splitCommentPage } from './comment-page';
import { toCommentItem, toPublicComment } from './comment-response';
import {
  readCommentTargetRef,
  rootListScope,
  type CommentTargetRef,
} from './comment-target';
import {
  CommentThreadRepository,
  type CommentTargetState,
} from './comment-thread.repository';
import { buildCommentTreeFromFlat } from './comment-thread.util';
import { CommentRepository, type CommentItemRow } from './comment.repository';
import type { CommentDto, CommentPageDto } from './dto/comment-response.dto';
import type {
  ListCommentRepliesQueryDto,
  ListCommentsQueryDto,
} from './dto/list-comments-query.dto';

/** Читання коментарів: порції (D27) і старе дерево (до M1.7.3). */
@Injectable()
export class CommentListService {
  constructor(
    private commentRepository: CommentRepository,
    private threadRepository: CommentThreadRepository,
    private languageService: LanguageService,
  ) {}

  /** Корені новини чи матчу, нові першими; без жодного коментаря — порожня порція. */
  async getRootsPage(
    query: ListCommentsQueryDto,
    viewer: AuthenticatedUser | undefined,
  ): Promise<CommentPageDto> {
    const targetRef = readCommentTargetRef(query);
    const cursorContext: CommentCursorContext = {
      order: query.sort,
      scope: rootListScope(targetRef),
    };
    const position = readCursorOrThrow(query.cursor, cursorContext);
    const target = await this.loadPublicTarget(targetRef);
    if (!target.thread) return { items: [], nextCursor: null };

    const rowsWithExtra = await this.commentRepository.findRootsPage(
      target.thread.id,
      { position, take: query.limit + 1 },
    );
    return this.toCommentPage(rowsWithExtra, query.limit, {
      cursorContext,
      viewer,
    });
  }

  /** Живі відповіді гілки, від старих до нових; корінь — живий або заглушка (D27). */
  async getRepliesPage(
    rootId: string,
    query: ListCommentRepliesQueryDto,
    viewer: AuthenticatedUser | undefined,
  ): Promise<CommentPageDto> {
    const cursorContext: CommentCursorContext = {
      order: 'oldest',
      scope: `replies:${rootId}`,
    };
    const position = readCursorOrThrow(query.cursor, cursorContext);
    const isRootListed = await this.commentRepository.existsListedRoot(
      rootId,
      await this.publicPostScope(),
    );
    if (!isRootListed) throw new NotFoundException('COMMENT_NOT_FOUND');

    const rowsWithExtra = await this.commentRepository.findRepliesPage(rootId, {
      position,
      take: query.limit + 1,
    });
    return this.toCommentPage(rowsWithExtra, query.limit, {
      cursorContext,
      viewer,
    });
  }

  /** Неживий пост → 404 (P4-1); живий без жодного коментаря → `[]`. */
  async getCommentsByPost(postId: string): Promise<CommentDto[]> {
    const target = await this.threadRepository.findLivePostTarget(
      postId,
      new Date(),
    );
    if (!target) throw new NotFoundException('POST_NOT_FOUND');
    return this.buildThreadTree(target);
  }

  async getCommentsByMatch(matchId: string): Promise<CommentDto[]> {
    const target = await this.threadRepository.findMatchTarget(matchId);
    if (!target) throw new NotFoundException('MATCH_NOT_FOUND');
    return this.buildThreadTree(target);
  }

  /** Пост — як у стрічці й новині (`publicPostWhere`), матч — існує. */
  private async loadPublicTarget(
    targetRef: CommentTargetRef,
  ): Promise<CommentTargetState> {
    if (targetRef.kind === 'post') {
      const target = await this.threadRepository.findPublicPostTarget(
        targetRef.postId,
        await this.publicPostScope(),
      );
      if (!target) throw new NotFoundException('POST_NOT_FOUND');
      return target;
    }
    const target = await this.threadRepository.findMatchTarget(
      targetRef.matchId,
    );
    if (!target) throw new NotFoundException('MATCH_NOT_FOUND');
    return target;
  }

  private async publicPostScope(): Promise<PublicPostScope> {
    const { defaultCode } = await this.languageService.getContentLanguages();
    return { now: new Date(), defaultLanguageCode: defaultCode };
  }

  /** Мої голоси — одним запитом на порцію (D27); гостю — `null`. */
  private async toCommentPage(
    rowsWithExtra: CommentItemRow[],
    limit: number,
    page: {
      cursorContext: CommentCursorContext;
      viewer: AuthenticatedUser | undefined;
    },
  ): Promise<CommentPageDto> {
    const { pageRows, nextPosition } = splitCommentPage(rowsWithExtra, limit);
    const reactions = page.viewer
      ? await this.commentRepository.findUserReactions(
          page.viewer.id,
          pageRows.map((row) => row.id),
        )
      : new Map<string, LikeType>();
    return {
      items: pageRows.map((row) =>
        toCommentItem(row, reactions.get(row.id) ?? null),
      ),
      nextCursor: nextPosition
        ? encodeCommentCursor(page.cursorContext, nextPosition)
        : null,
    };
  }

  private async buildThreadTree(
    target: CommentTargetState,
  ): Promise<CommentDto[]> {
    if (!target.thread) return [];
    const comments = await this.commentRepository.findLiveInThread(
      target.thread.id,
    );
    return buildCommentTreeFromFlat(comments.map(toPublicComment));
  }
}

/** Без курсора — перша порція; невалідний, з іншого списку чи порядку → 400. */
function readCursorOrThrow(
  rawCursor: string | undefined,
  context: CommentCursorContext,
): CommentPagePosition | null {
  if (rawCursor === undefined) return null;
  const position = decodeCommentCursor(rawCursor, context);
  if (!position) throw new BadRequestException('COMMENT_CURSOR_INVALID');
  return position;
}

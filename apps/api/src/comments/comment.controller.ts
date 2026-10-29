import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  OptionalCurrentUser,
} from '../auth/current-user.decorator';
import {
  AdminOnly,
  AuthOptional,
  AuthRequired,
} from '../auth/guards/access.decorators';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CommentListService } from './comment-list.service';
import { CommentPurgeService } from './comment-purge.service';
import { CommentService } from './comment.service';
import {
  CommentItemDto,
  CommentPageDto,
  CommentRootsPageDto,
  PurgedCommentDto,
  SoftDeletedCommentDto,
} from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  ListCommentRepliesQueryDto,
  ListCommentsQueryDto,
} from './dto/list-comments-query.dto';

@ApiTags('comments')
@Controller('comments')
export class CommentController {
  constructor(
    private commentListService: CommentListService,
    private commentService: CommentService,
    private commentPurgeService: CommentPurgeService,
  ) {}

  /**
   * Порція коренів новини чи матчу (як на YouTube): нові першими, далі — `nextCursor`; у кожній — `commentCount`.
   * Видалений корінь, під яким лишились відповіді, — заглушка. Зі сесією — ще й `myReaction`.
   * @throws {400} COMMENT_TARGET_INVALID — не рівно одне з postId / matchId; COMMENT_CURSOR_INVALID — курсор не з цього списку чи порядку
   * @throws {404} POST_NOT_FOUND — немає, ще не опублікована або видалена; MATCH_NOT_FOUND
   */
  @Get()
  @AuthOptional()
  getComments(
    @Query() query: ListCommentsQueryDto,
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<CommentRootsPageDto> {
    return this.commentListService.getRootsPage(query, user);
  }

  /**
   * Порція відповідей кореня, від старих до нових. Зі сесією — ще й `myReaction`.
   * @throws {400} COMMENT_CURSOR_INVALID — курсор не з цієї гілки
   * @throws {404} COMMENT_NOT_FOUND — немає, не корінь, видалений без відповідей або новина неопублікована
   */
  @Get(':id/replies')
  @AuthOptional()
  getReplies(
    @Param('id') id: string,
    @Query() query: ListCommentRepliesQueryDto,
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<CommentPageDto> {
    return this.commentListService.getRepliesPage(id, query, user);
  }

  /**
   * Коментар або відповідь (`parentId`). Відповідь на відповідь потрапляє в гілку її кореня з `replyTo`.
   * @throws {400} Невалідні поля; COMMENT_TARGET_INVALID — не рівно одне з postId / matchId; PARENT_COMMENT_MISMATCH — батько з іншого треду
   * @throws {403} COMMENT_THREAD_LOCKED, COMMENTS_SUSPENDED (санкція за спам), ACCOUNT_LOCKED
   * @throws {404} POST_NOT_FOUND, MATCH_NOT_FOUND, PARENT_COMMENT_NOT_FOUND
   * @throws {409} COMMENT_THREAD_CHANGED — гонка з видаленням: повторіть
   * @throws {429} COMMENT_COOLDOWN — не минула пауза між коментарями (за замовчуванням 60 с)
   */
  @Post()
  @AuthRequired()
  createComment(
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentItemDto> {
    return this.commentService.createComment(dto, user);
  }

  /**
   * Видалити коментар (soft delete) — автор або ADMIN. Відповіді кореня лишаються під заглушкою.
   * @throws {403} COMMENT_DELETE_FORBIDDEN — чужий коментар
   * @throws {404} COMMENT_NOT_FOUND
   * @throws {409} COMMENT_THREAD_CHANGED — гонка: повторіть
   */
  @Delete(':id')
  @AuthRequired()
  deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SoftDeletedCommentDto> {
    return this.commentService.deleteComment(id, user);
  }

  /**
   * ⚠️ Фізично видалити коментар без відповідей (legal / GDPR).
   * @throws {404} COMMENT_NOT_FOUND
   * @throws {409} COMMENT_HAS_REPLIES — є відповіді: `purge-thread`; COMMENT_THREAD_CHANGED — гонка
   */
  @Delete(':id/purge')
  @AdminOnly()
  purgeComment(@Param('id') id: string): Promise<PurgedCommentDto> {
    return this.commentPurgeService.purgeComment(id);
  }

  /**
   * ⚠️ Фізично видалити корінь з усіма відповідями гілки (відповідь — лише її саму).
   * @throws {404} COMMENT_NOT_FOUND
   * @throws {409} COMMENT_THREAD_CHANGED — гілка змінилась під час видалення: повторіть
   */
  @Delete(':id/purge-thread')
  @AdminOnly()
  purgeCommentThread(@Param('id') id: string): Promise<PurgedCommentDto> {
    return this.commentPurgeService.purgeCommentThread(id);
  }
}

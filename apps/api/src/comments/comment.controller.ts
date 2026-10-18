import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminOnly, AuthRequired } from '../auth/guards/access.decorators';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CommentService } from './comment.service';
import {
  CommentDto,
  PurgedCommentDto,
  SoftDeletedCommentDto,
} from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@Controller('comments')
export class CommentController {
  constructor(private commentService: CommentService) {}

  /**
   * Дерево коментарів новини (без коментарів — порожній масив).
   * @throws {404} POST_NOT_FOUND — немає, ще не опублікована або видалена
   */
  @Get('post/:postId')
  getByPost(@Param('postId') postId: string): Promise<CommentDto[]> {
    return this.commentService.getCommentsByPost(postId);
  }

  /**
   * Дерево коментарів матчу.
   * @throws {404} MATCH_NOT_FOUND
   */
  @Get('match/:matchId')
  getByMatch(@Param('matchId') matchId: string): Promise<CommentDto[]> {
    return this.commentService.getCommentsByMatch(matchId);
  }

  /**
   * Коментар або відповідь (`parentId`); у відповіді — створений коментар з `replies: []`.
   * @throws {400} Невалідні поля; COMMENT_TARGET_INVALID — не рівно одне з postId / matchId; PARENT_COMMENT_MISMATCH — батько з іншого треду; COMMENT_DEPTH_EXCEEDED
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
  ): Promise<CommentDto> {
    return this.commentService.createComment(dto, user);
  }

  /**
   * Видалити коментар разом з усією гілкою відповідей (soft delete) — автор або ADMIN.
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
    return this.commentService.purgeComment(id);
  }

  /**
   * ⚠️ Фізично видалити коментар з усім піддеревом відповідей.
   * @throws {404} COMMENT_NOT_FOUND
   * @throws {409} COMMENT_THREAD_CHANGED — піддерево змінилось під час видалення: повторіть
   */
  @Delete(':id/purge-thread')
  @AdminOnly()
  purgeCommentThread(@Param('id') id: string): Promise<PurgedCommentDto> {
    return this.commentService.purgeCommentThread(id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('comments')
export class CommentController {
  constructor(private commentService: CommentService) {}

  // Публічний — дерево коментарів живого поста
  @Get('post/:postId')
  getByPost(@Param('postId') postId: string) {
    return this.commentService.getCommentsByPost(postId);
  }

  // Публічний — дерево коментарів матчу
  @Get('match/:matchId')
  getByMatch(@Param('matchId') matchId: string) {
    return this.commentService.getCommentsByMatch(matchId);
  }

  // Авторизовані — створити коментар або відповідь
  @Post()
  @UseGuards(JwtAuthGuard)
  createComment(@Body() dto: CreateCommentDto, @Req() req: Request) {
    return this.commentService.createComment(
      dto,
      req.user as AuthenticatedUser,
    );
  }

  // Автор або адмін — soft delete разом з гілкою відповідей
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteComment(@Param('id') id: string, @Req() req: Request) {
    return this.commentService.deleteComment(id, req.user as AuthenticatedUser);
  }

  // ⚠️ Деструктивно: рядок фізично зникає з БД (розділ 7.5.2)
  @Delete(':id/purge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  purgeComment(@Param('id') id: string) {
    return this.commentService.purgeComment(id);
  }

  // ⚠️ Деструктивно: коментар і все піддерево відповідей
  @Delete(':id/purge-thread')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  purgeCommentThread(@Param('id') id: string) {
    return this.commentService.purgeCommentThread(id);
  }
}

import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('comments')
export class CommentController {
  constructor(private commentService: CommentService) {}

  // Публічний — всі бачать коментарі
  @Get('post/:postId')
  getByPost(@Param('postId') postId: string) {
    return this.commentService.getCommentsByPost(postId);
  }

  // Тільки авторизовані можуть писати коментарі
  @Post()
  @UseGuards(JwtAuthGuard)
  createComment(@Body() dto: CreateCommentDto, @Req() req: Request) {
    const user = req.user as { id: string; role: string };
    return this.commentService.createComment(dto, user.id);
  }

  // Автор коментаря або адмін можуть видаляти
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteComment(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string; role: string };
    return this.commentService.deleteComment(id, user.id, user.role);
  }
}
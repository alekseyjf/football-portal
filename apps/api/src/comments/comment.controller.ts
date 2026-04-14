import {
    Controller, Get, Post, Delete,
    Param, Body, UseGuards, Req,
  } from '@nestjs/common';
  import type { Request } from 'express';
  import { CommentService } from './comment.service';
  import { CreateCommentDto } from './dto/create-comment.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  
  @Controller('comments')
  export class CommentController {
    constructor(private commentService: CommentService) {}
  
    // Публічний — коментарі до поста з replies
    @Get('post/:postId')
    getByPost(@Param('postId') postId: string) {
      return this.commentService.getCommentsByPost(postId);
    }
  
    // Публічний — коментарі до матчу з replies
    @Get('match/:matchId')
    getByMatch(@Param('matchId') matchId: string) {
      return this.commentService.getCommentsByMatch(matchId);
    }
  
    // Авторизовані — створити коментар або відповідь
    @Post()
    @UseGuards(JwtAuthGuard)
    createComment(@Body() dto: CreateCommentDto, @Req() req: Request) {
      const user = req.user as { id: string; role: string };
      return this.commentService.createComment(dto, user.id, user.role);
    }
  
    // Автор або адмін — soft delete
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    deleteComment(@Param('id') id: string, @Req() req: Request) {
      const user = req.user as { id: string; role: string };
      return this.commentService.deleteComment(id, user.id, user.role);
    }
  }
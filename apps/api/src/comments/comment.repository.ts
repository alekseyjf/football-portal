import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

// Базовий select для автора — використовується скрізь
const authorSelect = {
  select: { id: true, name: true, avatar: true },
};

@Injectable()
export class CommentRepository {
  constructor(private prisma: PrismaService) {}

  async findByPostId(postId: string) {
    return this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null,   // тільки коментарі першого рівня
        deletedAt: null,
      },
      select: {
        id: true,
        content: true,
        pinnedAt: true,
        createdAt: true,
        author: authorSelect,
        // Replies вкладено
        replies: {
          where: { deletedAt: null },
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: authorSelect,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      // Спочатку закріплені, потім нові
      orderBy: [{ pinnedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findByMatchId(matchId: string) {
    return this.prisma.comment.findMany({
      where: {
        matchId,
        parentId: null,
        deletedAt: null,
      },
      select: {
        id: true,
        content: true,
        pinnedAt: true,
        createdAt: true,
        author: authorSelect,
        replies: {
          where: { deletedAt: null },
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: authorSelect,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ pinnedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateCommentDto, authorId: string) {
    return this.prisma.comment.create({
      data: {
        content: dto.content,
        authorId,
        postId: dto.postId,
        matchId: dto.matchId,
        parentId: dto.parentId,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        parentId: true,
        author: authorSelect,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        deletedAt: true,
        parentId: true,
      },
    });
  }


  async softDelete(id: string) {
    // Soft delete — зберігаємо в БД для модерації
    return this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
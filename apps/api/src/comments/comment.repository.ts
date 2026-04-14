import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  buildCommentTreeFromFlat,
  type CommentTreeNode,
} from './comment-thread.util';

const authorSelect = {
  select: { id: true, name: true, avatar: true },
};

@Injectable()
export class CommentRepository {
  constructor(private prisma: PrismaService) {}

  async findByPostId(postId: string): Promise<CommentTreeNode[]> {
    const rows = await this.prisma.comment.findMany({
      where: { postId, deletedAt: null },
      select: {
        id: true,
        content: true,
        pinnedAt: true,
        createdAt: true,
        parentId: true,
        author: authorSelect,
      },
    });
    return buildCommentTreeFromFlat(rows);
  }

  async findByMatchId(matchId: string): Promise<CommentTreeNode[]> {
    const rows = await this.prisma.comment.findMany({
      where: { matchId, deletedAt: null },
      select: {
        id: true,
        content: true,
        pinnedAt: true,
        createdAt: true,
        parentId: true,
        author: authorSelect,
      },
    });
    return buildCommentTreeFromFlat(rows);
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

  async createWithTx(
    tx: Prisma.TransactionClient,
    dto: CreateCommentDto,
    authorId: string,
  ) {
    return tx.comment.create({
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
        postId: true,
        matchId: true,
      },
    });
  }

  /**
   * Кількість кроків до кореня (корінь = 0). Для валідації max depth.
   */
  async depthFromRoot(commentId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = commentId;
    for (;;) {
      const row = await this.prisma.comment.findUnique({
        where: { id: currentId! },
        select: { parentId: true, deletedAt: true },
      });
      if (!row || row.deletedAt) return -1;
      if (!row.parentId) return depth;
      depth += 1;
      currentId = row.parentId;
    }
  }

  async softDelete(id: string) {
    return this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

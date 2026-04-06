import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommentRepository {
  constructor(private prisma: PrismaService) {}

  async findByPostId(postId: string) {
    return this.prisma.comment.findMany({
      where: { postId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(content: string, postId: string, authorId: string) {
    return this.prisma.comment.create({
      data: { content, postId, authorId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatar: true } },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.comment.findUnique({ where: { id } });
  }

  async delete(id: string) {
    return this.prisma.comment.delete({ where: { id } });
  }
}
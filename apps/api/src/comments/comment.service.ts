import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommentAntiAbuseService } from './comment-anti-abuse.service';
import { CommentRepository } from './comment.repository';
import { MAX_COMMENT_THREAD_DEPTH } from './comment-thread.constants';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentService {
  constructor(
    private commentRepository: CommentRepository,
    private commentAntiAbuse: CommentAntiAbuseService,
    private prisma: PrismaService,
  ) {}

  async getCommentsByPost(postId: string) {
    return this.commentRepository.findByPostId(postId);
  }

  async getCommentsByMatch(matchId: string) {
    return this.commentRepository.findByMatchId(matchId);
  }

  async createComment(
    dto: CreateCommentDto,
    authorId: string,
    userRole: string,
  ) {
    if (!dto.postId && !dto.matchId) {
      throw new BadRequestException('postId or matchId is required');
    }

    if (dto.parentId) {
      const parent = await this.commentRepository.findById(dto.parentId);
      if (!parent || parent.deletedAt) {
        throw new NotFoundException('Parent comment not found');
      }
      if (dto.postId && parent.postId !== dto.postId) {
        throw new BadRequestException('Parent comment belongs to another post');
      }
      if (dto.matchId && parent.matchId !== dto.matchId) {
        throw new BadRequestException('Parent comment belongs to another match');
      }
      const parentDepth = await this.commentRepository.depthFromRoot(dto.parentId);
      if (parentDepth < 0 || parentDepth + 1 > MAX_COMMENT_THREAD_DEPTH) {
        throw new BadRequestException('Maximum comment thread depth exceeded');
      }
    }

    const isAdmin = userRole === 'ADMIN';
    await this.commentAntiAbuse.assertCanCommentOrThrow(authorId, isAdmin);
    await this.commentAntiAbuse.recordCommentAttemptAndEnforceBurstOrThrow(
      authorId,
      isAdmin,
    );

    return this.prisma.$transaction(async (tx) => {
      const comment = await this.commentRepository.createWithTx(
        tx,
        dto,
        authorId,
      );
      await tx.user.update({
        where: { id: authorId },
        data: { lastCommentAt: new Date() },
      });
      return comment;
    });
  }

  async deleteComment(id: string, userId: string, userRole: string) {
    const comment = await this.commentRepository.findById(id);
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    const isAuthor = comment.authorId === userId;
    const isAdmin = userRole === 'ADMIN';
    if (!isAuthor && !isAdmin) throw new ForbiddenException('No access');

    return this.commentRepository.softDelete(id);
  }
}

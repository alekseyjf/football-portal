import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CommentRepository } from './comment.repository';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentService {
  constructor(private commentRepository: CommentRepository) {}

  async getCommentsByPost(postId: string) {
    return this.commentRepository.findByPostId(postId);
  }

  async getCommentsByMatch(matchId: string) {
    return this.commentRepository.findByMatchId(matchId);
  }

  async createComment(dto: CreateCommentDto, authorId: string) {
    if (!dto.postId && !dto.matchId) {
      throw new BadRequestException('postId or matchId is required');
    }

    if (dto.parentId) {
      const parent = await this.commentRepository.findById(dto.parentId);
      if (!parent) throw new NotFoundException('Parent comment not found');
      if (parent.parentId) {
        throw new BadRequestException('Replies to replies are not allowed');
      }
    }

    return this.commentRepository.create(dto, authorId);
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

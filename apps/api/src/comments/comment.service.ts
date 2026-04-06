import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommentRepository } from './comment.repository';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentService {
  constructor(private commentRepository: CommentRepository) {}

  async getCommentsByPost(postId: string) {
    return this.commentRepository.findByPostId(postId);
  }

  async createComment(dto: CreateCommentDto, authorId: string) {
    return this.commentRepository.create(dto.content, dto.postId, authorId);
  }

  async deleteComment(id: string, userId: string, userRole: string) {
    const comment = await this.commentRepository.findById(id);
    if (!comment) throw new NotFoundException('Comment not found');

    // Видалити може або автор коментаря або адмін
    const isAuthor = comment.authorId === userId;
    const isAdmin = userRole === 'ADMIN';
    if (!isAuthor && !isAdmin) throw new ForbiddenException('No access');

    return this.commentRepository.delete(id);
  }
}
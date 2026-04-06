import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostRepository } from './post.repository';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostService {
  constructor(private postRepository: PostRepository) {}

  async getPosts(page = 1, limit = 10) {
    const { posts, total } = await this.postRepository.findAll(page, limit);
    return {
      data: posts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPostBySlug(slug: string) {
    const post = await this.postRepository.findBySlug(slug);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async getAllForAdmin() {
    return this.postRepository.findAllForAdmin();
  }

  async createPost(dto: CreatePostDto, authorId: string) {
    return this.postRepository.create(dto, authorId);
  }

  async updatePost(id: string, dto: UpdatePostDto, userId: string, userRole: string) {
    const post = await this.postRepository.findById(id);
    if (!post) throw new NotFoundException('Post not found');

    // Редагувати може або сам автор або адмін
    const isAuthor = (post as any).author?.id === userId;
    const isAdmin = userRole === 'ADMIN';
    if (!isAuthor && !isAdmin) throw new ForbiddenException('No access');

    return this.postRepository.update(id, dto);
  }

  async deletePost(id: string) {
    const post = await this.postRepository.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    return this.postRepository.delete(id);
  }
}
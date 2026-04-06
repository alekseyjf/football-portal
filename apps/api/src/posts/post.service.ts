import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostRepository } from './post.repository';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostService {
  constructor(private postRepository: PostRepository) {}

  async getPosts(page = 1, limit = 10, lang = 'en') {
    const { posts, total } = await this.postRepository.findAll(page, limit, lang);
    return {
      data: posts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPostBySlug(slug: string, lang = 'en') {
    const post = await this.postRepository.findBySlug(slug, lang);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async getAllForAdmin(lang = 'en') {
    return this.postRepository.findAllForAdmin(lang);
  }

  async createPost(dto: CreatePostDto, authorId: string) {
    if (!dto.translations?.length) {
      throw new Error('At least one translation is required');
    }
    return this.postRepository.create(dto, authorId);
  }

  async updatePost(id: string, dto: UpdatePostDto, userId: string, userRole: string) {
    const post = await this.postRepository.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    if (post.deletedAt) throw new NotFoundException('Post not found');

    const isAuthor = post.author?.id === userId;
    const isAdmin = userRole === 'ADMIN';
    if (!isAuthor && !isAdmin) throw new ForbiddenException('No access');

    return this.postRepository.update(id, dto);
  }

  async deletePost(id: string) {
    const post = await this.postRepository.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    // Soft delete — зберігаємо в БД для модерації і аудиту
    return this.postRepository.softDelete(id);
  }
}
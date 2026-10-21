import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminPostRepository } from './admin-post.repository';
import type {
  AdminPostDetailDto,
  PaginatedAdminPostsDto,
} from './dto/admin-post-response.dto';
import { ListAdminPostsQueryDto } from './dto/list-admin-posts-query.dto';
import { toAdminPostDetail, toAdminPostView } from './post-response';

/** Новини для адмінки: читання будь-якого статусу, крім видалених. Записи — `PostEditorService`. */
@Injectable()
export class AdminPostService {
  constructor(private readonly adminPostRepository: AdminPostRepository) {}

  async getAdminPostPage(
    query: ListAdminPostsQueryDto,
  ): Promise<PaginatedAdminPostsDto> {
    const now = new Date();
    const { posts, total } = await this.adminPostRepository.findAdminPage({
      filters: query,
      now,
      pagination: { skip: (query.page - 1) * query.limit, take: query.limit },
    });
    return {
      data: posts.map((postRow) => toAdminPostView(postRow, now)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getAdminPostById(id: string): Promise<AdminPostDetailDto> {
    const postRow = await this.adminPostRepository.findAdminDetail(id);
    if (!postRow) throw new NotFoundException('POST_NOT_FOUND');
    return toAdminPostDetail(postRow, new Date());
  }
}

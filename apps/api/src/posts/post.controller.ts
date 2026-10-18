import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminOnly } from '../auth/guards/access.decorators';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ContentLanguageQueryDto } from '../languages/dto/content-language-query.dto';
import { AdminPostDto, DeletedPostDto } from './dto/admin-post-response.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PaginatedPostsDto, PostDetailDto } from './dto/post-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService } from './post.service';

@ApiTags('posts')
@Controller('posts')
export class PostController {
  constructor(private postService: PostService) {}

  /** Стрічка опублікованих новин, новіші першими. */
  @Get()
  getPosts(@Query() query: ListPostsQueryDto): Promise<PaginatedPostsDto> {
    return this.postService.getPublicPosts(query);
  }

  /** Усі новини для адмінки (крім видалених), заголовки всіма мовами. */
  // ⚠️ admin/all ОБОВ'ЯЗКОВО перед :slug — інакше NestJS думає що 'admin' це slug
  @Get('admin/all')
  @AdminOnly()
  getAllForAdmin(): Promise<AdminPostDto[]> {
    return this.postService.getAllForAdmin();
  }

  /**
   * Опублікована новина з текстом.
   * @throws {404} POST_NOT_FOUND — немає, ще не опублікована або видалена
   */
  @Get(':slug')
  getPostBySlug(
    @Param('slug') slug: string,
    @Query() query: ContentLanguageQueryDto,
  ): Promise<PostDetailDto> {
    return this.postService.getPublicPostBySlug(slug, query.lang);
  }

  /**
   * Створити новину; без `status` — чернетка.
   * @throws {400} Невалідні поля; DEFAULT_TRANSLATION_REQUIRED, DUPLICATE_TRANSLATION_LANGUAGE, UNSUPPORTED_LANGUAGE, POST_STATUS_NOT_ALLOWED, PUBLISHED_AT_NOT_ALLOWED, PUBLISHED_AT_REQUIRED, PUBLISHED_AT_IN_FUTURE, SCHEDULED_AT_IN_PAST, UNKNOWN_TAG, UNKNOWN_CLUB, UNKNOWN_COMPETITION
   */
  @Post()
  @AdminOnly()
  createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminPostDto> {
    return this.postService.createPost(dto, user.id);
  }

  /**
   * Змінити новину: переклади — upsert за мовою, передані зв'язки замінюють наявні.
   * @throws {400} Невалідні поля або коди, як у створенні
   * @throws {404} POST_NOT_FOUND
   */
  // Лише ADMIN (P3-7): зі `status` в тілі автор без ролі міг би публікувати
  @Put(':id')
  @AdminOnly()
  updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<AdminPostDto> {
    return this.postService.updatePost(id, dto);
  }

  /**
   * Видалити новину (soft delete: з сайту зникає, рядок лишається).
   * @throws {404} POST_NOT_FOUND
   */
  @Delete(':id')
  @AdminOnly()
  deletePost(@Param('id') id: string): Promise<DeletedPostDto> {
    return this.postService.deletePost(id);
  }
}

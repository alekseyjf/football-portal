import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import {
  AdminPostDetailDto,
  AdminPostDto,
  DeletedPostDto,
  PaginatedAdminPostsDto,
  PinnedAdminPostDto,
} from './dto/admin-post-response.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListAdminPostsQueryDto } from './dto/list-admin-posts-query.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PinPostDto } from './dto/pin-post.dto';
import { PostNumberParamDto } from './dto/post-number-param.dto';
import {
  HomePostsDto,
  PaginatedPostsDto,
  PostDetailDto,
} from './dto/post-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { AdminPostService } from './admin-post.service';
import { PostEditorService } from './post-editor.service';
import { PostPinService } from './post-pin.service';
import { PublicPostService } from './public-post.service';

@ApiTags('posts')
@Controller('posts')
export class PostController {
  constructor(
    private publicPostService: PublicPostService,
    private adminPostService: AdminPostService,
    private postEditorService: PostEditorService,
    private postPinService: PostPinService,
  ) {}

  /**
   * Стрічка опублікованих новин, новіші першими.
   * @remarks Фільтри `tags`, `competition`, `club`: усередині фільтра — будь-який зі slug-ів, між фільтрами — «і»
   * (`?tags=transfers&club=arsenal` — трансфери «Арсенала»). Невідомий slug — порожня сторінка, а не 400.
   */
  @Get()
  getPosts(@Query() query: ListPostsQueryDto): Promise<PaginatedPostsDto> {
    return this.publicPostService.getPublicPosts(query);
  }

  /**
   * Новини головної сторінки сайту: головна — закріплена редактором, інакше найсвіжіша; під нею — шість найсвіжіших
   * без неї (дубля немає).
   */
  // Раніше за `:number`: інакше `home` дістався б йому як номер (400)
  @Get('home')
  getHomePosts(@Query() query: ContentLanguageQueryDto): Promise<HomePostsDto> {
    return this.publicPostService.getHomePosts(query.lang);
  }

  /**
   * Список новин для адмінки — сторінками, нові першими: будь-який статус, крім видалених, заголовки всіма мовами.
   * @remarks `status` — як показує адмінка: запланована новина, чия дата настала, — серед PUBLISHED.
   * `search` — частина заголовка будь-якою мовою, без урахування регістру. Фільтри разом — «і».
   */
  // Раніше за `admin/:id`: інакше `all` дістався б йому як id
  @Get('admin/all')
  @AdminOnly()
  getAdminPostPage(
    @Query() query: ListAdminPostsQueryDto,
  ): Promise<PaginatedAdminPostsDto> {
    return this.adminPostService.getAdminPostPage(query);
  }

  /** Закріплена головна новина — для тексту підтвердження заміни; `post: null` — не закріплена жодна. */
  // Раніше за `admin/:id`
  @Get('admin/pinned')
  @AdminOnly()
  getPinnedPost(): Promise<PinnedAdminPostDto> {
    return this.postPinService.getPinnedPost();
  }

  /**
   * Новина для форми редагування — будь-якого статусу: усі переклади з текстом, медіа, джерело, теги, турніри, клуби.
   * @throws {404} POST_NOT_FOUND — немає або видалена
   */
  @Get('admin/:id')
  @AdminOnly()
  getAdminPostById(@Param('id') id: string): Promise<AdminPostDetailDto> {
    return this.adminPostService.getAdminPostById(id);
  }

  /**
   * Опублікована новина з текстом — за номером з URL `{slug}-{number}`. Slug у відповіді — канонічний:
   * інший slug в адресі сайт перенаправляє (308) на нього.
   * @throws {400} Номер — не ціле число від 1 до 2147483647
   * @throws {404} POST_NOT_FOUND — немає, ще не опублікована або видалена
   */
  @Get(':number')
  getPostByNumber(
    @Param() params: PostNumberParamDto,
    @Query() query: ContentLanguageQueryDto,
  ): Promise<PostDetailDto> {
    return this.publicPostService.getPublicPostByNumber(
      params.number,
      query.lang,
    );
  }

  /**
   * Створити новину; без `status` — чернетка.
   * @throws {400} Невалідні поля; DEFAULT_TRANSLATION_REQUIRED, DUPLICATE_TRANSLATION_LANGUAGE, UNSUPPORTED_LANGUAGE, POST_STATUS_NOT_ALLOWED, PUBLISHED_AT_NOT_ALLOWED, PUBLISHED_AT_REQUIRED, PUBLISHED_AT_IN_FUTURE, SCHEDULED_AT_IN_PAST, COVER_IMAGE_ALT_REQUIRED, COVER_IMAGE_CREDIT_REQUIRED, SOURCE_URL_REQUIRED, UNKNOWN_TAG, UNKNOWN_CLUB, UNKNOWN_COMPETITION
   */
  @Post()
  @AdminOnly()
  createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminPostDto> {
    return this.postEditorService.createPost(dto, user.id);
  }

  /**
   * Змінити новину: переклади — upsert за мовою, передані зв'язки замінюють наявні. Новина зникла з сайту (чернетка,
   * архів, дата в майбутньому) — закріплення знімається.
   * @throws {400} Невалідні поля; DUPLICATE_TRANSLATION_LANGUAGE, UNSUPPORTED_LANGUAGE, PUBLISHED_AT_NOT_ALLOWED, PUBLISHED_AT_REQUIRED, PUBLISHED_AT_IN_FUTURE, SCHEDULED_AT_IN_PAST, COVER_IMAGE_ALT_REQUIRED, COVER_IMAGE_CREDIT_REQUIRED, SOURCE_URL_REQUIRED, UNKNOWN_TAG, UNKNOWN_CLUB, UNKNOWN_COMPETITION
   * @throws {404} POST_NOT_FOUND
   */
  // Лише ADMIN (P3-7): зі `status` в тілі автор без ролі міг би публікувати
  @Put(':id')
  @AdminOnly()
  updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<AdminPostDto> {
    return this.postEditorService.updatePost(id, dto);
  }

  /**
   * Закріпити новину головною на сайті замість `replacesPostId` (попередню закріплену відкріплює). Вже закріплена —
   * без змін.
   * @throws {404} POST_NOT_FOUND — немає або видалена
   * @throws {409} POST_NOT_LIVE — не на сайті: чернетка, ще не випущена запланована, архівна
   * @throws {409} PINNED_POST_CHANGED — закріплена вже не `replacesPostId` (інша вкладка, інший редактор)
   */
  @Post(':id/pin')
  @HttpCode(200)
  @AdminOnly()
  pinPost(
    @Param('id') id: string,
    @Body() dto: PinPostDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminPostDto> {
    return this.postPinService.pinPost(id, dto, user.id);
  }

  /**
   * Відкріпити новину: головною на сайті стане найсвіжіша. Не закріплена — без змін.
   * @throws {404} POST_NOT_FOUND — немає або видалена
   */
  @Delete(':id/pin')
  @AdminOnly()
  unpinPost(@Param('id') id: string): Promise<AdminPostDto> {
    return this.postPinService.unpinPost(id);
  }

  /**
   * Видалити новину (soft delete: з сайту зникає, рядок лишається); закріплення знімається.
   * @throws {404} POST_NOT_FOUND
   */
  @Delete(':id')
  @AdminOnly()
  deletePost(@Param('id') id: string): Promise<DeletedPostDto> {
    return this.postEditorService.deletePost(id);
  }
}

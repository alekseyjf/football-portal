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
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/guards/access.decorators';
import { ContentLanguageQueryDto } from '../languages/dto/content-language-query.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { TagSlugParamDto } from './dto/tag-slug-param.dto';
import { AdminTagDto, DeletedTagDto, TagDto } from './dto/tag-response.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagService } from './tag.service';

/**
 * Заготовка тіла `POST /tags` у Swagger UI — без `slug`: з автоматичною (`"slug": "string"`) тег отримав би
 * адресу `string` назавжди, якщо її не стерти (до M1.5 теги створюють через Swagger).
 */
const CREATE_TAG_BODY_EXAMPLE = {
  translations: [
    { languageCode: 'en', name: 'Transfers' },
    { languageCode: 'uk', name: 'Трансфери' },
  ],
};

@ApiTags('tags')
@Controller('tags')
export class TagController {
  constructor(private tagService: TagService) {}

  /**
   * Теги, у яких є опубліковані новини, — за абеткою назви мовою запиту (фільтри стрічки, sitemap).
   * Назви без перекладу запитаною мовою — англійською.
   */
  @Get()
  getTags(@Query() query: ContentLanguageQueryDto): Promise<TagDto[]> {
    return this.tagService.getPublicTags(query.lang);
  }

  /** Усі теги для адмінки: назви всіма мовами й кількість новин. */
  @Get('admin/all')
  @AdminOnly()
  getAllForAdmin(): Promise<AdminTagDto[]> {
    return this.tagService.getAllForAdmin();
  }

  /**
   * Тег за slug-ом — для сторінки тегу `/{locale}/news/tag/{slug}`; є й тоді, коли опублікованих новин
   * з ним немає.
   * @throws {400} Slug не того формату
   * @throws {404} TAG_NOT_FOUND
   */
  @Get(':slug')
  getTagBySlug(
    @Param() params: TagSlugParamDto,
    @Query() query: ContentLanguageQueryDto,
  ): Promise<TagDto> {
    return this.tagService.getPublicTagBySlug(params.slug, query.lang);
  }

  /**
   * Створити тег; без `slug` — з англійської назви. Slug після створення не змінюється.
   * @throws {400} Невалідні поля; DEFAULT_TRANSLATION_REQUIRED, DUPLICATE_TRANSLATION_LANGUAGE, UNSUPPORTED_LANGUAGE, TAG_SLUG_REQUIRED — в англійській назві немає латиниці: задайте `slug`
   * @throws {409} TAG_SLUG_TAKEN — тег з таким slug-ом уже є
   */
  @Post()
  @AdminOnly()
  @ApiBody({
    type: CreateTagDto,
    examples: {
      withoutSlug: {
        summary: 'Назви EN і UK; slug — з англійської назви',
        value: CREATE_TAG_BODY_EXAMPLE,
      },
    },
  })
  createTag(@Body() dto: CreateTagDto): Promise<AdminTagDto> {
    return this.tagService.createTag(dto);
  }

  /**
   * Перейменувати тег: назви — upsert за мовою; slug не змінюється.
   * @throws {400} Невалідні поля; DUPLICATE_TRANSLATION_LANGUAGE, UNSUPPORTED_LANGUAGE
   * @throws {404} TAG_NOT_FOUND
   */
  @Put(':id')
  @AdminOnly()
  updateTag(
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<AdminTagDto> {
    return this.tagService.updateTag(id, dto);
  }

  /**
   * ⚠️ Видалити тег назавжди: він зникне з усіх новин, і з чернеток (скільки їх — `postCount` у списку адмінки).
   * @throws {404} TAG_NOT_FOUND
   */
  @Delete(':id')
  @AdminOnly()
  deleteTag(@Param('id') id: string): Promise<DeletedTagDto> {
    return this.tagService.deleteTag(id);
  }
}

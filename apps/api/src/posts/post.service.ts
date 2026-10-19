import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LanguageService,
  type ContentLanguageChoice,
  type ContentLanguages,
} from '../languages/language.service';
import { isRecordNotFound } from '../prisma/prisma-errors';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import type { PostFieldsDto, PostTranslationDto } from './dto/post-fields.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  resolvePostPublication,
  type PostPublication,
  type PostPublicationInput,
} from './post-publication';
import type {
  AdminPostDto,
  DeletedPostDto,
} from './dto/admin-post-response.dto';
import type { PaginatedPostsDto, PostDetailDto } from './dto/post-response.dto';
import {
  toAdminPostView,
  toPublicPostDetail,
  toPublicPostSummary,
} from './post-response';
import { resolveUpdatedPostSlug, slugifyTitle } from './post-slug';
import {
  PostRepository,
  type PostEditStateRow,
  type PublicPostScope,
} from './post.repository';

function languageCodesToLoad(languageChoice: ContentLanguageChoice): string[] {
  return [
    ...new Set([languageChoice.requestedCode, languageChoice.defaultCode]),
  ];
}

function publicScope(
  languageChoice: ContentLanguageChoice,
  now: Date,
): PublicPostScope {
  return { now, defaultLanguageCode: languageChoice.defaultCode };
}

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly languageService: LanguageService,
  ) {}

  async getPublicPosts(query: ListPostsQueryDto): Promise<PaginatedPostsDto> {
    const languageChoice = await this.languageService.chooseContentLanguage(
      query.lang,
    );
    const { posts, total } = await this.postRepository.findPublicPage(
      publicScope(languageChoice, new Date()),
      languageCodesToLoad(languageChoice),
      { skip: (query.page - 1) * query.limit, take: query.limit },
    );
    return {
      data: posts.map((postRow) =>
        toPublicPostSummary(postRow, languageChoice),
      ),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getPublicPostByNumber(
    postNumber: number,
    requestedLang: unknown,
  ): Promise<PostDetailDto> {
    const [languageChoice, { activeCodes }] = await Promise.all([
      this.languageService.chooseContentLanguage(requestedLang),
      this.languageService.getContentLanguages(),
    ]);
    const scope = publicScope(languageChoice, new Date());
    const [postRow, translationLanguages] = await Promise.all([
      this.postRepository.findPublicByNumber(
        postNumber,
        scope,
        languageCodesToLoad(languageChoice),
      ),
      this.postRepository.findPublicTranslationLanguages(postNumber, scope),
    ]);
    if (!postRow) throw new NotFoundException('POST_NOT_FOUND');

    return toPublicPostDetail(
      postRow,
      languageChoice,
      // Переклад вимкненою мовою не рекламуємо в hreflang
      translationLanguages.filter((languageCode) =>
        activeCodes.has(languageCode),
      ),
    );
  }

  async getAllForAdmin(): Promise<AdminPostDto[]> {
    const now = new Date();
    const postRows = await this.postRepository.findAllForAdmin();
    return postRows.map((postRow) => toAdminPostView(postRow, now));
  }

  async createPost(
    dto: CreatePostDto,
    authorId: string,
  ): Promise<AdminPostDto> {
    const languages = await this.languageService.getContentLanguages();
    this.assertTranslationsSupported(dto.translations, languages);
    const defaultTranslation = dto.translations.find(
      (translation) => translation.languageCode === languages.defaultCode,
    );
    if (!defaultTranslation) {
      throw new BadRequestException('DEFAULT_TRANSLATION_REQUIRED');
    }

    const now = new Date();
    const publication = this.resolvePublication(dto, null, now);
    await this.assertRelationsExist(dto);

    const postRow = await this.postRepository.create({
      // Унікальність не потрібна: новину визначає номер (D24)
      slug: dto.slug ?? slugifyTitle(defaultTranslation.title),
      ...publication,
      coverImageUrl: dto.coverImageUrl,
      videoUrl: dto.videoUrl,
      sourceUrl: dto.sourceUrl,
      authorId,
      translations: dto.translations.map(toTranslationInput),
      tagIds: dto.tagIds,
      clubIds: dto.clubIds,
      competitionIds: dto.competitionIds,
    });
    return toAdminPostView(postRow, now);
  }

  async updatePost(id: string, dto: UpdatePostDto): Promise<AdminPostDto> {
    const languages = await this.languageService.getContentLanguages();
    const currentPost = await this.postRepository.findEditState(
      id,
      languages.defaultCode,
    );
    if (!currentPost) throw new NotFoundException('POST_NOT_FOUND');

    if (dto.translations) {
      this.assertTranslationsSupported(dto.translations, languages);
    }
    const now = new Date();
    const currentPublication: PostPublication = {
      status: currentPost.status,
      publishedAt: currentPost.publishedAt,
    };
    const publication = this.resolvePublication(dto, currentPublication, now);
    await this.assertRelationsExist(dto);
    const slug = updatedSlug(currentPost, dto, languages.defaultCode);

    try {
      const postRow = await this.postRepository.update(id, {
        // Лише якщо змінюється: інакше правка заголовка з давно відкритої форми
        // перезаписала б статус, який інший адмін встиг змінити (lost update)
        ...(isSamePublication(publication, currentPublication)
          ? {}
          : publication),
        slug,
        coverImageUrl: dto.coverImageUrl,
        videoUrl: dto.videoUrl,
        sourceUrl: dto.sourceUrl,
        translations: dto.translations?.map(toTranslationInput),
        tagIds: dto.tagIds,
        clubIds: dto.clubIds,
        competitionIds: dto.competitionIds,
      });
      return toAdminPostView(postRow, now);
    } catch (error) {
      // Пост видалили між читанням і записом
      if (isRecordNotFound(error)) {
        throw new NotFoundException('POST_NOT_FOUND');
      }
      throw error;
    }
  }

  async deletePost(id: string): Promise<DeletedPostDto> {
    // Soft delete — рядок лишається для модерації й аудиту
    const isDeleted = await this.postRepository.softDelete(id, new Date());
    if (!isDeleted) throw new NotFoundException('POST_NOT_FOUND');
    return { id };
  }

  private resolvePublication(
    dto: PostFieldsDto,
    current: PostPublicationInput['current'],
    now: Date,
  ): PostPublication {
    const result = resolvePostPublication({
      current,
      requestedStatus: dto.status,
      // `null` = не передано: `new Date(null)` дав би 1970-01-01 (backdating PUBLISHED)
      requestedPublishedAt:
        dto.publishedAt == null ? undefined : new Date(dto.publishedAt),
      now,
    });
    if (!result.isValid) throw new BadRequestException(result.errorCode);
    return result.publication;
  }

  /** Лише активні мови (P3-3), кожна — не більше одного разу. */
  private assertTranslationsSupported(
    translations: PostTranslationDto[],
    languages: ContentLanguages,
  ): void {
    const seenLanguageCodes = new Set<string>();
    for (const { languageCode } of translations) {
      if (seenLanguageCodes.has(languageCode)) {
        throw new BadRequestException('DUPLICATE_TRANSLATION_LANGUAGE');
      }
      seenLanguageCodes.add(languageCode);
      if (!languages.activeCodes.has(languageCode)) {
        throw new BadRequestException('UNSUPPORTED_LANGUAGE');
      }
    }
  }

  /** Неіснуючий id → 400 з кодом, а не 500 на FK (P3-8). Масиви вже унікальні (DTO). */
  private async assertRelationsExist(dto: PostFieldsDto): Promise<void> {
    const tagIds = dto.tagIds ?? [];
    const clubIds = dto.clubIds ?? [];
    const competitionIds = dto.competitionIds ?? [];
    if (!tagIds.length && !clubIds.length && !competitionIds.length) return;

    const existingCounts = await this.postRepository.countExistingRelations({
      tagIds,
      clubIds,
      competitionIds,
    });
    if (existingCounts.tags !== tagIds.length) {
      throw new BadRequestException('UNKNOWN_TAG');
    }
    if (existingCounts.clubs !== clubIds.length) {
      throw new BadRequestException('UNKNOWN_CLUB');
    }
    if (existingCounts.competitions !== competitionIds.length) {
      throw new BadRequestException('UNKNOWN_COMPETITION');
    }
  }
}

function isSamePublication(
  first: PostPublication,
  second: PostPublication,
): boolean {
  return (
    first.status === second.status &&
    first.publishedAt?.getTime() === second.publishedAt?.getTime()
  );
}

/** Новий slug (D24) або `undefined` — не змінювати. */
function updatedSlug(
  currentPost: PostEditStateRow,
  dto: UpdatePostDto,
  defaultLanguageCode: string,
): string | undefined {
  return resolveUpdatedPostSlug({
    current: {
      slug: currentPost.slug,
      publishedAt: currentPost.publishedAt,
      defaultTitle: currentPost.translations[0]?.title,
    },
    requestedSlug: dto.slug,
    requestedDefaultTitle: dto.translations?.find(
      (translation) => translation.languageCode === defaultLanguageCode,
    )?.title,
  });
}

function toTranslationInput(translation: PostTranslationDto) {
  return {
    languageCode: translation.languageCode,
    title: translation.title,
    excerpt: translation.excerpt,
    content: translation.content,
  };
}

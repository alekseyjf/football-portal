import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  LanguageService,
  type ContentLanguageChoice,
  type ContentLanguages,
} from '../languages/language.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import type { PostFieldsDto, PostTranslationDto } from './dto/post-fields.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  resolvePostPublication,
  type PostPublication,
  type PostPublicationInput,
} from './post-publication';
import {
  toAdminPostView,
  toPublicPostDetail,
  toPublicPostSummary,
  type AdminPostView,
  type PublicPostDetail,
  type PublicPostSummary,
} from './post-response';
import { slugifyTitle, withRandomSlugSuffix } from './post-slug';
import {
  PostRepository,
  type AdminPostRow,
  type PublicPostScope,
} from './post.repository';

/** Спроб створити пост з випадковим суфіксом slug-а після колізії (P3-6). */
const SLUG_COLLISION_RETRIES = 5;

export interface PaginatedPublicPosts {
  data: PublicPostSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly languageService: LanguageService,
  ) {}

  async getPublicPosts(
    query: ListPostsQueryDto,
  ): Promise<PaginatedPublicPosts> {
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

  async getPublicPostBySlug(
    slug: string,
    requestedLang: unknown,
  ): Promise<PublicPostDetail> {
    const [languageChoice, { activeCodes }] = await Promise.all([
      this.languageService.chooseContentLanguage(requestedLang),
      this.languageService.getContentLanguages(),
    ]);
    const scope = publicScope(languageChoice, new Date());
    const [postRow, translationLanguages] = await Promise.all([
      this.postRepository.findPublicBySlug(
        slug,
        scope,
        languageCodesToLoad(languageChoice),
      ),
      this.postRepository.findPublicTranslationLanguages(slug, scope),
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

  async getAllForAdmin(): Promise<AdminPostView[]> {
    const now = new Date();
    const postRows = await this.postRepository.findAllForAdmin();
    return postRows.map((postRow) => toAdminPostView(postRow, now));
  }

  async createPost(
    dto: CreatePostDto,
    authorId: string,
  ): Promise<AdminPostView> {
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

    const slugBase = slugifyTitle(defaultTranslation.title);
    const postRow = await this.createWithUniqueSlug(slugBase, (slug) =>
      this.postRepository.create({
        slug,
        ...publication,
        coverImageUrl: dto.coverImageUrl,
        videoUrl: dto.videoUrl,
        sourceUrl: dto.sourceUrl,
        authorId,
        translations: dto.translations.map(toTranslationInput),
        tagIds: dto.tagIds,
        clubIds: dto.clubIds,
        competitionIds: dto.competitionIds,
      }),
    );
    return toAdminPostView(postRow, now);
  }

  async updatePost(id: string, dto: UpdatePostDto): Promise<AdminPostView> {
    const currentPublication =
      await this.postRepository.findPublicationState(id);
    if (!currentPublication) throw new NotFoundException('POST_NOT_FOUND');

    if (dto.translations) {
      const languages = await this.languageService.getContentLanguages();
      this.assertTranslationsSupported(dto.translations, languages);
    }
    const now = new Date();
    const publication = this.resolvePublication(dto, currentPublication, now);
    await this.assertRelationsExist(dto);

    try {
      const postRow = await this.postRepository.update(id, {
        // Лише якщо змінюється: інакше правка заголовка з давно відкритої форми
        // перезаписала б статус, який інший адмін встиг змінити (lost update)
        ...(isSamePublication(publication, currentPublication)
          ? {}
          : publication),
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
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('POST_NOT_FOUND');
      }
      throw error;
    }
  }

  async deletePost(id: string): Promise<{ id: string }> {
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

  /**
   * Унікальність slug-а тримає `@unique` (без check-then-insert гонки): `P2002` →
   * повтор із випадковим суфіксом. Інших unique-обмежень у вставці немає — переклади
   * без дублів мов, зв'язки без дублів id (DTO + `assertTranslationsSupported`).
   */
  private async createWithUniqueSlug(
    slugBase: string,
    createPost: (slug: string) => Promise<AdminPostRow>,
  ): Promise<AdminPostRow> {
    for (let attempt = 0; ; attempt++) {
      const slug = attempt === 0 ? slugBase : withRandomSlugSuffix(slugBase);
      try {
        return await createPost(slug);
      } catch (error) {
        if (
          !isPrismaError(error, 'P2002') ||
          attempt >= SLUG_COLLISION_RETRIES
        ) {
          throw error;
        }
      }
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

function toTranslationInput(translation: PostTranslationDto) {
  return {
    languageCode: translation.languageCode,
    title: translation.title,
    excerpt: translation.excerpt,
    content: translation.content,
  };
}

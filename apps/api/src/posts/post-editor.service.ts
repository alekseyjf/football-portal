import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugifyTitle } from '@football-portal/validation';
import { LanguageService } from '../languages/language.service';
import {
  findTranslationLanguagesError,
  type TranslationLanguagesInput,
} from '../languages/translation-languages';
import {
  isForeignKeyViolation,
  isRecordNotFound,
} from '../prisma/prisma-errors';
import {
  AdminPostRepository,
  type PostEditStateRow,
  type PostTranslationInput,
} from './admin-post.repository';
import { CreatePostDto } from './dto/create-post.dto';
import type { PostFieldsDto, PostTranslationDto } from './dto/post-fields.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  coverImageTextToStore,
  resolvePostCoverImage,
  type PostCoverImageInput,
  type PostCoverImagePhoto,
} from './post-cover-image';
import {
  resolvePostPublication,
  type PostPublication,
  type PostPublicationInput,
} from './post-publication';
import type {
  AdminPostDto,
  DeletedPostDto,
} from './dto/admin-post-response.dto';
import { toAdminPostView } from './post-response';
import { resolveUpdatedPostSlug } from './post-slug';
import {
  resolvePostSource,
  type PostSourceInput,
  type PostSourceWrite,
} from './post-source';

/**
 * Редагування новин адміном: створення, зміна, видалення. Правила полів — чисті функції
 * (`resolvePostPublication`, `resolvePostCoverImage`, `resolvePostSource`, `resolveUpdatedPostSlug`).
 */
@Injectable()
export class PostEditorService {
  constructor(
    private readonly adminPostRepository: AdminPostRepository,
    private readonly languageService: LanguageService,
  ) {}

  async createPost(
    dto: CreatePostDto,
    authorId: string,
  ): Promise<AdminPostDto> {
    const languages = await this.languageService.getContentLanguages();
    this.assertTranslationsAllowed({
      translations: dto.translations,
      isNew: true,
      languages,
    });
    // Переклад default-мови є: без нього assertTranslationsAllowed кидає 400
    const defaultTranslation = dto.translations.find(
      (translation) => translation.languageCode === languages.defaultCode,
    )!;

    const now = new Date();
    const publication = this.resolvePublication(dto, null, now);
    const coverPhoto = this.resolveCoverImage({
      current: null,
      requested: dto,
      status: publication.status,
      activeLanguageCodes: languages.activeCodes,
    });
    const source = this.resolveSource({ current: null, requested: dto });
    await this.assertRelationsExist(dto);

    try {
      const postRow = await this.adminPostRepository.create({
        // Унікальність не потрібна: новину визначає номер (D24)
        slug: dto.slug ?? slugifyTitle(defaultTranslation.title),
        ...publication,
        coverImageUrl: dto.coverImageUrl,
        coverImageCredit: coverImageTextToStore(
          dto.coverImageCredit,
          coverPhoto,
        ),
        videoUrl: dto.videoUrl,
        sourceUrl: source.sourceUrl,
        sourceName: source.sourceName,
        authorId,
        translations: dto.translations.map((translation) =>
          toTranslationInput(translation, coverPhoto),
        ),
        tagIds: dto.tagIds,
        clubIds: dto.clubIds,
        competitionIds: dto.competitionIds,
      });
      return toAdminPostView(postRow, now);
    } catch (error) {
      await this.throwIfRelationVanished(error, dto);
      throw error;
    }
  }

  async updatePost(id: string, dto: UpdatePostDto): Promise<AdminPostDto> {
    const languages = await this.languageService.getContentLanguages();
    const currentPost = await this.adminPostRepository.findEditState(id);
    if (!currentPost) throw new NotFoundException('POST_NOT_FOUND');

    if (dto.translations) {
      this.assertTranslationsAllowed({
        translations: dto.translations,
        isNew: false,
        languages,
      });
    }
    const now = new Date();
    const currentPublication: PostPublication = {
      status: currentPost.status,
      publishedAt: currentPost.publishedAt,
    };
    const publication = this.resolvePublication(dto, currentPublication, now);
    const coverPhoto = this.resolveCoverImage({
      current: currentPost,
      requested: dto,
      status: publication.status,
      activeLanguageCodes: languages.activeCodes,
    });
    const source = this.resolveSource({ current: currentPost, requested: dto });
    await this.assertRelationsExist(dto);
    const slug = updatedSlug(currentPost, dto, languages.defaultCode);

    try {
      const postRow = await this.adminPostRepository.update(id, {
        // Лише якщо змінюється: інакше правка заголовка з давно відкритої форми
        // перезаписала б статус, який інший адмін встиг змінити (lost update)
        ...(isSamePublication(publication, currentPublication)
          ? {}
          : publication),
        slug,
        coverImageUrl: dto.coverImageUrl,
        coverImageCredit: coverImageTextToStore(
          dto.coverImageCredit,
          coverPhoto,
        ),
        videoUrl: dto.videoUrl,
        sourceUrl: source.sourceUrl,
        sourceName: source.sourceName,
        translations: dto.translations?.map((translation) =>
          toTranslationInput(translation, coverPhoto),
        ),
        // Фото змінилось чи прибране — опис попереднього не лишаємо й у перекладах поза запитом
        clearCoverImageAlts: !coverPhoto.isSamePhoto,
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
      await this.throwIfRelationVanished(error, dto);
      throw error;
    }
  }

  async deletePost(id: string): Promise<DeletedPostDto> {
    // Soft delete — рядок лишається для модерації й аудиту
    const isDeleted = await this.adminPostRepository.softDelete(id, new Date());
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

  /** Опис і підпис обкладинки — за правилом `resolvePostCoverImage` (D44). */
  private resolveCoverImage(input: PostCoverImageInput): PostCoverImagePhoto {
    const result = resolvePostCoverImage(input);
    if (!result.isValid) throw new BadRequestException(result.errorCode);
    return {
      hasCoverImage: result.hasCoverImage,
      isSamePhoto: result.isSamePhoto,
    };
  }

  /** Що записати в адресу й назву джерела — за правилом `resolvePostSource` (D26). */
  private resolveSource(input: PostSourceInput): PostSourceWrite {
    const result = resolvePostSource(input);
    if (!result.isValid) throw new BadRequestException(result.errorCode);
    return result.source;
  }

  /** Мови перекладів — за правилом `findTranslationLanguagesError` (D23, P3-3). */
  private assertTranslationsAllowed(input: TranslationLanguagesInput): void {
    const errorCode = findTranslationLanguagesError(input);
    if (errorCode) throw new BadRequestException(errorCode);
  }

  /** Неіснуючий id → 400 з кодом, а не 500 на FK (P3-8). Масиви вже унікальні (DTO). */
  private async assertRelationsExist(dto: PostFieldsDto): Promise<void> {
    const tagIds = dto.tagIds ?? [];
    const clubIds = dto.clubIds ?? [];
    const competitionIds = dto.competitionIds ?? [];
    if (!tagIds.length && !clubIds.length && !competitionIds.length) return;

    const existingCounts =
      await this.adminPostRepository.countExistingRelations({
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
   * Запис упав на FK, бо тег видалили між `assertRelationsExist` і записом (D45): повторна перевірка дає
   * ту саму відповідь, що й без гонки, — 400 UNKNOWN_TAG. Інша помилка — далі кидає той, хто викликав.
   */
  private async throwIfRelationVanished(
    error: unknown,
    dto: PostFieldsDto,
  ): Promise<void> {
    if (isForeignKeyViolation(error)) await this.assertRelationsExist(dto);
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
      defaultTitle: currentPost.translations.find(
        (translation) => translation.languageCode === defaultLanguageCode,
      )?.title,
    },
    requestedSlug: dto.slug,
    requestedDefaultTitle: dto.translations?.find(
      (translation) => translation.languageCode === defaultLanguageCode,
    )?.title,
  });
}

function toTranslationInput(
  translation: PostTranslationDto,
  coverPhoto: PostCoverImagePhoto,
): PostTranslationInput {
  return {
    languageCode: translation.languageCode,
    title: translation.title,
    excerpt: translation.excerpt,
    content: translation.content,
    coverImageAlt: coverImageTextToStore(translation.coverImageAlt, coverPhoto),
  };
}

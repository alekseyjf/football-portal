import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugify, TAG_SLUG_MAX_LENGTH } from '@football-portal/validation';
import { LanguageService } from '../languages/language.service';
import { languageCodesToLoad } from '../languages/translation-fallback';
import {
  findTranslationLanguagesError,
  type TranslationLanguagesInput,
} from '../languages/translation-languages';
import { isRecordNotFound, isUniqueViolationOn } from '../prisma/prisma-errors';
import { CreateTagDto } from './dto/create-tag.dto';
import type {
  AdminTagDto,
  DeletedTagDto,
  TagDto,
} from './dto/tag-response.dto';
import type { TagTranslationDto } from './dto/tag-translation.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { sortTagsByName, toAdminTag, toPublicTag } from './tag-response';
import { TagRepository, type TagTranslationInput } from './tag.repository';

@Injectable()
export class TagService {
  constructor(
    private readonly tagRepository: TagRepository,
    private readonly languageService: LanguageService,
  ) {}

  async getPublicTags(requestedLang: unknown): Promise<TagDto[]> {
    const languageChoice =
      await this.languageService.chooseContentLanguage(requestedLang);
    const tagRows = await this.tagRepository.findWithPublicPosts(
      { now: new Date(), defaultLanguageCode: languageChoice.defaultCode },
      languageCodesToLoad(languageChoice),
    );
    return sortTagsByName(
      tagRows.map((tagRow) => toPublicTag(tagRow, languageChoice)),
      languageChoice.requestedCode,
    );
  }

  async getPublicTagBySlug(
    slug: string,
    requestedLang: unknown,
  ): Promise<TagDto> {
    const languageChoice =
      await this.languageService.chooseContentLanguage(requestedLang);
    const tagRow = await this.tagRepository.findBySlug(
      slug,
      languageCodesToLoad(languageChoice),
    );
    if (!tagRow) throw new NotFoundException('TAG_NOT_FOUND');
    return toPublicTag(tagRow, languageChoice);
  }

  async getAllForAdmin(): Promise<AdminTagDto[]> {
    const tagRows = await this.tagRepository.findAllForAdmin();
    return tagRows.map(toAdminTag);
  }

  async createTag(dto: CreateTagDto): Promise<AdminTagDto> {
    const languages = await this.languageService.getContentLanguages();
    this.assertTranslationsAllowed({
      translations: dto.translations,
      isNew: true,
      languages,
    });
    // Назва default-мови є: без неї assertTranslationsAllowed кидає 400
    const defaultName = dto.translations.find(
      (translation) => translation.languageCode === languages.defaultCode,
    )!.name;
    const slug = dto.slug ?? slugify(defaultName, TAG_SLUG_MAX_LENGTH);
    // Без fallback, як `post` у новин: тег визначає slug, і всі такі теги отримали б один
    if (!slug) throw new BadRequestException('TAG_SLUG_REQUIRED');

    try {
      const tagRow = await this.tagRepository.create({
        slug,
        translations: dto.translations.map(toTranslationInput),
      });
      return toAdminTag(tagRow);
    } catch (error) {
      // Без попередньої перевірки: унікальний індекс `Tag.slug` ловить і паралельне створення того самого тегу
      if (isUniqueViolationOn(error, 'Tag')) {
        throw new ConflictException('TAG_SLUG_TAKEN');
      }
      throw error;
    }
  }

  async updateTag(id: string, dto: UpdateTagDto): Promise<AdminTagDto> {
    const languages = await this.languageService.getContentLanguages();
    this.assertTranslationsAllowed({
      translations: dto.translations,
      isNew: false,
      languages,
    });
    try {
      const tagRow = await this.tagRepository.update(
        id,
        dto.translations.map(toTranslationInput),
      );
      return toAdminTag(tagRow);
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundException('TAG_NOT_FOUND');
      throw error;
    }
  }

  async deleteTag(id: string): Promise<DeletedTagDto> {
    // Фізично: тег зникає з усіх новин (D45); скільки їх — адмінка показує до підтвердження (`postCount`)
    const isDeleted = await this.tagRepository.delete(id);
    if (!isDeleted) throw new NotFoundException('TAG_NOT_FOUND');
    return { id };
  }

  /** Мови назв — те саме правило, що й для перекладів новини (D23, D45). */
  private assertTranslationsAllowed(input: TranslationLanguagesInput): void {
    const errorCode = findTranslationLanguagesError(input);
    if (errorCode) throw new BadRequestException(errorCode);
  }
}

function toTranslationInput(
  translation: TagTranslationDto,
): TagTranslationInput {
  return { languageCode: translation.languageCode, name: translation.name };
}

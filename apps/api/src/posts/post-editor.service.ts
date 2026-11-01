import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LanguageService } from '../languages/language.service';
import { isForeignKeyViolation } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPostRepository } from './admin-post.repository';
import type {
  AdminPostDto,
  DeletedPostDto,
} from './dto/admin-post-response.dto';
import { CreatePostDto } from './dto/create-post.dto';
import type { PostFieldsDto } from './dto/post-fields.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  assertUpdatedTranslationsAllowed,
  postCreateData,
  postUpdateData,
} from './post-edit-fields';
import { PostEventPublisher } from './post-event-publisher';
import { postEvents } from './post-events';
import { changesPublicContent } from './post-public-content';
import { toAdminPostView } from './post-response';

/**
 * Редагування новин адміном: створення, зміна, видалення. Що записати — за правилами полів (`post-edit-fields.ts`);
 * події (D57) — після коміту запису (`postEvents`).
 */
@Injectable()
export class PostEditorService {
  constructor(
    private readonly adminPostRepository: AdminPostRepository,
    private readonly languageService: LanguageService,
    private readonly postEventPublisher: PostEventPublisher,
    private readonly prisma: PrismaService,
  ) {}

  async createPost(
    dto: CreatePostDto,
    authorId: string,
  ): Promise<AdminPostDto> {
    const languages = await this.languageService.getContentLanguages();
    const now = new Date();
    const postData = postCreateData({ dto, authorId, languages, now });
    await this.assertRelationsExist(dto);

    try {
      const postRow = await this.adminPostRepository.create(postData);
      this.postEventPublisher.publish(postEvents(null, postRow));
      return toAdminPostView(postRow, now);
    } catch (error) {
      await this.throwIfRelationVanished(error, dto);
      throw error;
    }
  }

  /**
   * Зміна — у транзакції під блокуванням новини (`lockEditState`): правила полів дивляться на свіжий стан, тож ні
   * воркер розкладу, ні інший редактор, що встигли першими, не губляться, а подія публікації — одна (D57).
   */
  async updatePost(id: string, dto: UpdatePostDto): Promise<AdminPostDto> {
    const languages = await this.languageService.getContentLanguages();
    assertUpdatedTranslationsAllowed(dto, languages);
    // До транзакції: лічильники зв'язків не тримають блокування новини
    await this.assertRelationsExist(dto);
    const now = new Date();

    try {
      const { currentPost, postRow, isPublicChange } =
        await this.prisma.$transaction(async (tx) => {
          const lockedPost = await this.adminPostRepository.lockEditState(
            tx,
            id,
          );
          if (!lockedPost) throw new NotFoundException('POST_NOT_FOUND');
          const postData = postUpdateData({
            currentPost: lockedPost,
            dto,
            languages,
            now,
          });
          return {
            currentPost: lockedPost,
            postRow: await this.adminPostRepository.update(tx, id, postData),
            isPublicChange: changesPublicContent(lockedPost, postData),
          };
        });
      this.postEventPublisher.publish(
        postEvents(currentPost, postRow, isPublicChange),
      );
      return toAdminPostView(postRow, now);
    } catch (error) {
      await this.throwIfRelationVanished(error, dto);
      throw error;
    }
  }

  async deletePost(id: string): Promise<DeletedPostDto> {
    // Soft delete — рядок лишається для модерації й аудиту; закріплення знімається тим самим записом (D56)
    const deletedPost = await this.adminPostRepository.softDelete(
      id,
      new Date(),
    );
    if (!deletedPost) throw new NotFoundException('POST_NOT_FOUND');
    this.postEventPublisher.publish(postEvents(deletedPost, null));
    return { id };
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

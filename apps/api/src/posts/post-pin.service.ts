import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolationOfIndex } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminPostRow } from './admin-post.repository';
import type {
  AdminPostDto,
  PinnedAdminPostDto,
} from './dto/admin-post-response.dto';
import { PinPostDto } from './dto/pin-post.dto';
import { decidePin } from './post-pin';
import { PostPinRepository } from './post-pin.repository';
import { toAdminPostView } from './post-response';

/** Частковий унікальний індекс «не більше однієї закріпленої» (`constraints.sql`, міграція 0011). */
const SINGLE_PINNED_POST_INDEX = 'Post_single_pinned_idx';

/**
 * Закріплення головної новини редактором (D56). Хто й коли закріпив — лише в адмінці; сайт бере головну
 * з `GET /posts/home`. Правило — `decidePin`; сервіс блокує рядки й записує рішення.
 */
@Injectable()
export class PostPinService {
  constructor(
    private readonly postPinRepository: PostPinRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getPinnedPost(): Promise<PinnedAdminPostDto> {
    const postRow = await this.postPinRepository.findPinnedAdminRow();
    return { post: postRow && toAdminPostView(postRow, new Date()) };
  }

  /** Закріпити замість тієї, яку підтвердив редактор: зняти попередню й закріпити нову — одна транзакція. */
  async pinPost(
    postId: string,
    dto: PinPostDto,
    pinnedById: string,
  ): Promise<AdminPostDto> {
    const now = new Date();
    try {
      const postRow = await this.prisma.$transaction(async (tx) => {
        const target = await this.postPinRepository.lockPinTarget(tx, postId);
        if (!target) throw new NotFoundException('POST_NOT_FOUND');
        const currentPinnedPostId = target.pinnedAt
          ? target.id
          : await this.postPinRepository.lockPinnedPostId(tx);
        const decision = decidePin({
          target,
          currentPinnedPostId,
          replacesPostId: dto.replacesPostId,
          now,
        });
        if (decision.kind === 'rejected') {
          throw new ConflictException(decision.errorCode);
        }
        if (decision.kind === 'pin') {
          if (decision.unpinPostId) {
            await this.postPinRepository.unpinInTransaction(
              tx,
              decision.unpinPostId,
            );
          }
          await this.postPinRepository.pin(tx, {
            postId,
            pinnedById,
            pinnedAt: now,
          });
        }
        return this.requireAdminRow(
          await this.postPinRepository.findAdminRow(tx, postId),
        );
      });
      return toAdminPostView(postRow, now);
    } catch (error) {
      // Паралельне закріплення встигло першим: закріплена вже не та, яку підтвердив редактор
      if (isUniqueViolationOfIndex(error, SINGLE_PINNED_POST_INDEX)) {
        throw new ConflictException('PINNED_POST_CHANGED');
      }
      throw error;
    }
  }

  async unpinPost(postId: string): Promise<AdminPostDto> {
    const postRow = this.requireAdminRow(
      await this.postPinRepository.unpin(postId),
    );
    return toAdminPostView(postRow, new Date());
  }

  private requireAdminRow(postRow: AdminPostRow | null): AdminPostRow {
    if (!postRow) throw new NotFoundException('POST_NOT_FOUND');
    return postRow;
  }
}

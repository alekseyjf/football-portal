import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LikeType, Role } from '@prisma/client';
import type { LikeStatsDto } from './dto/like-stats-response.dto';
import {
  LIKE_TARGET_TYPES,
  ToggleLikeDto,
  type LikeTargetTypeDto,
} from './dto/toggle-like.dto';
import { LikeAntiAbuseService } from './like-anti-abuse.service';
import { LikeRepository } from './like.repository';

@Injectable()
export class LikeService {
  constructor(
    private likeRepository: LikeRepository,
    private likeAntiAbuse: LikeAntiAbuseService,
  ) {}

  async getStats(
    targetTypeParam: string,
    targetId: string,
    userId?: string,
  ): Promise<LikeStatsDto> {
    const targetType = this.parseTargetType(targetTypeParam);
    await this.ensureTargetExists(targetType, targetId);

    const likesCount = await this.likeRepository.getPublicLikeCount(
      targetType,
      targetId,
    );

    let myReaction: LikeType | null = null;
    if (userId) {
      const reaction = await this.likeRepository.findUserReaction(
        targetType,
        userId,
        targetId,
      );
      myReaction = reaction;
    }

    return { likesCount, myReaction };
  }

  async toggle(
    userId: string,
    userRole: Role,
    dto: ToggleLikeDto,
  ): Promise<LikeStatsDto> {
    const isAdmin = userRole === Role.ADMIN;
    const targetType = dto.targetType;
    await this.ensureTargetExists(targetType, dto.targetId);
    await this.likeAntiAbuse.assertCanLikeOrThrow(userId, isAdmin);
    await this.likeAntiAbuse.recordLikeAttemptAndEnforceBurstOrThrow(
      userId,
      isAdmin,
    );

    const outcome = await this.likeRepository.applyToggleWithCounterUpdate(
      targetType,
      userId,
      dto.targetId,
      dto.action,
    );
    // Ціль зникла між перевіркою і транзакцією (purge коментаря)
    if (!outcome) throw new NotFoundException('Target not found');

    return this.getStats(targetType, dto.targetId, userId);
  }

  private parseTargetType(param: string): LikeTargetTypeDto {
    const targetType = LIKE_TARGET_TYPES.find(
      (knownType) => knownType === param,
    );
    if (!targetType) throw new BadRequestException('Invalid target type');
    return targetType;
  }

  private async ensureTargetExists(
    targetType: LikeTargetTypeDto,
    targetId: string,
  ) {
    let exists = false;
    if (targetType === 'post') {
      exists = await this.likeRepository.assertPostExists(targetId);
    } else if (targetType === 'comment') {
      exists = await this.likeRepository.assertCommentExists(targetId);
    } else {
      exists = await this.likeRepository.assertMatchExists(targetId);
    }
    if (!exists) throw new NotFoundException('Target not found');
  }
}

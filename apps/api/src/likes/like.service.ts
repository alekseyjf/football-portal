import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LikeType } from '@prisma/client';
import { ToggleLikeDto, type LikeTargetTypeDto } from './dto/toggle-like.dto';
import { LikeAntiAbuseService } from './like-anti-abuse.service';
import { LikeRepository } from './like.repository';

export type LikeStatsResponse = {
  likesCount: number;
  myReaction: 'LIKE' | 'DISLIKE' | null;
};

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
  ): Promise<LikeStatsResponse> {
    const targetType = this.parseTargetType(targetTypeParam);
    await this.ensureTargetExists(targetType, targetId);

    const likesCount = await this.likeRepository.getPublicLikeCount(
      targetType,
      targetId,
    );

    let myReaction: 'LIKE' | 'DISLIKE' | null = null;
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
    userRole: string,
    dto: ToggleLikeDto,
  ): Promise<LikeStatsResponse> {
    const isAdmin = userRole === 'ADMIN';
    const targetType = dto.targetType;
    await this.ensureTargetExists(targetType, dto.targetId);
    await this.likeAntiAbuse.assertCanLikeOrThrow(userId, isAdmin);
    await this.likeAntiAbuse.recordLikeAttemptAndEnforceBurstOrThrow(
      userId,
      isAdmin,
    );

    const action =
      dto.action === 'LIKE' ? LikeType.LIKE : LikeType.DISLIKE;

    await this.likeRepository.applyToggleWithCounterUpdate(
      targetType,
      userId,
      dto.targetId,
      action,
    );

    return this.getStats(targetType, dto.targetId, userId);
  }

  private parseTargetType(param: string): LikeTargetTypeDto {
    if (param === 'post' || param === 'comment' || param === 'match') {
      return param;
    }
    throw new BadRequestException('Invalid target type');
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

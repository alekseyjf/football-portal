import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  OptionalCurrentUser,
} from '../auth/current-user.decorator';
import { AuthOptional, AuthRequired } from '../auth/guards/access.decorators';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { LikeStatsDto } from './dto/like-stats-response.dto';
import { LIKE_TARGET_TYPES, ToggleLikeDto } from './dto/toggle-like.dto';
import { LikeService } from './like.service';

@ApiTags('likes')
@Controller('likes')
export class LikeController {
  constructor(private likeService: LikeService) {}

  /**
   * Лайки цілі; із сесією — ще й мій голос.
   * @throws {400} Invalid target type
   * @throws {404} Target not found — немає, не опублікована або видалена
   */
  @Get('stats/:targetType/:targetId')
  @AuthOptional()
  @ApiParam({
    name: 'targetType',
    enum: LIKE_TARGET_TYPES,
    enumName: 'LikeTargetType',
  })
  getStats(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<LikeStatsDto> {
    return this.likeService.getStats(targetType, targetId, user?.id);
  }

  /**
   * Поставити / зняти лайк чи дизлайк; у відповіді — статистика після зміни.
   * @throws {403} LIKES_SUSPENDED (санкція за спам), ACCOUNT_LOCKED
   * @throws {404} Target not found
   */
  @Post()
  @AuthRequired()
  toggle(
    @Body() dto: ToggleLikeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LikeStatsDto> {
    return this.likeService.toggle(user.id, user.role, dto);
  }
}

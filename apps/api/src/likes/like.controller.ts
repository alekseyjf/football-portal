import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  OptionalCurrentUser,
} from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ToggleLikeDto } from './dto/toggle-like.dto';
import { LikeService } from './like.service';

@Controller('likes')
export class LikeController {
  constructor(private likeService: LikeService) {}

  @Get('stats/:targetType/:targetId')
  @UseGuards(OptionalJwtAuthGuard)
  getStats(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.likeService.getStats(targetType, targetId, user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  toggle(@Body() dto: ToggleLikeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.likeService.toggle(user.id, user.role, dto);
  }
}

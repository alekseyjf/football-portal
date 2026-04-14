import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
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
    @Req() req: Request,
  ) {
    const user = req.user as { id: string } | undefined;
    return this.likeService.getStats(targetType, targetId, user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  toggle(@Body() dto: ToggleLikeDto, @Req() req: Request) {
    const user = req.user as { id: string; role: string };
    return this.likeService.toggle(user.id, user.role, dto);
  }
}

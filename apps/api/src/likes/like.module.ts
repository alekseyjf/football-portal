import { Module } from '@nestjs/common';
import { LikeAntiAbuseService } from './like-anti-abuse.service';
import { LikeController } from './like.controller';
import { LikeRepository } from './like.repository';
import { LikeService } from './like.service';

@Module({
  controllers: [LikeController],
  providers: [LikeService, LikeRepository, LikeAntiAbuseService],
})
export class LikeModule {}

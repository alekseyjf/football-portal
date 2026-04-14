import { Module } from '@nestjs/common';
import { CommentAntiAbuseService } from './comment-anti-abuse.service';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';

@Module({
  controllers: [CommentController],
  providers: [CommentService, CommentRepository, CommentAntiAbuseService],
})
export class CommentModule {}

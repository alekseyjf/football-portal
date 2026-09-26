import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { CommentAntiAbuseService } from './comment-anti-abuse.service';
import { CommentThreadRepository } from './comment-thread.repository';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';

@Module({
  imports: [SecurityModule],
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentRepository,
    CommentThreadRepository,
    CommentAntiAbuseService,
  ],
})
export class CommentModule {}

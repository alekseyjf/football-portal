import { Module } from '@nestjs/common';
import { LanguagesModule } from '../languages/languages.module';
import { SecurityModule } from '../security/security.module';
import { CommentAntiAbuseService } from './comment-anti-abuse.service';
import { CommentEditService } from './comment-edit.service';
import { CommentListService } from './comment-list.service';
import { CommentPurgeService } from './comment-purge.service';
import { CommentThreadRepository } from './comment-thread.repository';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';

@Module({
  imports: [SecurityModule, LanguagesModule],
  controllers: [CommentController],
  providers: [
    CommentListService,
    CommentService,
    CommentEditService,
    CommentPurgeService,
    CommentRepository,
    CommentThreadRepository,
    CommentAntiAbuseService,
  ],
})
export class CommentModule {}

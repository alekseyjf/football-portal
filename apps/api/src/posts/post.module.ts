import { Module } from '@nestjs/common';
import { LanguagesModule } from '../languages/languages.module';
import { AdminPostRepository } from './admin-post.repository';
import { AdminPostService } from './admin-post.service';
import { PostEditorService } from './post-editor.service';
import { PostEventPublisher } from './post-event-publisher';
import { PostPinRepository } from './post-pin.repository';
import { PostPinService } from './post-pin.service';
import { PostSitemapRepository } from './post-sitemap.repository';
import { PostSitemapService } from './post-sitemap.service';
import { PostController } from './post.controller';
import { PublicPostRepository } from './public-post.repository';
import { PublicPostService } from './public-post.service';
import { ScheduledPostPublisher } from './scheduled-post-publisher.service';
import { ScheduledPostRepository } from './scheduled-post.repository';

@Module({
  imports: [LanguagesModule],
  controllers: [PostController],
  providers: [
    PublicPostService,
    AdminPostService,
    PostEditorService,
    PostPinService,
    PostSitemapService,
    ScheduledPostPublisher,
    PostEventPublisher,
    PublicPostRepository,
    AdminPostRepository,
    PostPinRepository,
    PostSitemapRepository,
    ScheduledPostRepository,
  ],
})
export class PostModule {}

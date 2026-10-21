import { Module } from '@nestjs/common';
import { LanguagesModule } from '../languages/languages.module';
import { AdminPostRepository } from './admin-post.repository';
import { AdminPostService } from './admin-post.service';
import { PostEditorService } from './post-editor.service';
import { PostController } from './post.controller';
import { PublicPostRepository } from './public-post.repository';
import { PublicPostService } from './public-post.service';

@Module({
  imports: [LanguagesModule],
  controllers: [PostController],
  providers: [
    PublicPostService,
    AdminPostService,
    PostEditorService,
    PublicPostRepository,
    AdminPostRepository,
  ],
})
export class PostModule {}

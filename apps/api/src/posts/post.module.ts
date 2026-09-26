import { Module } from '@nestjs/common';
import { LanguagesModule } from '../languages/languages.module';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PostRepository } from './post.repository';

@Module({
  imports: [LanguagesModule],
  controllers: [PostController],
  providers: [PostService, PostRepository],
})
export class PostModule {}

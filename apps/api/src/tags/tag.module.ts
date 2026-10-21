import { Module } from '@nestjs/common';
import { LanguagesModule } from '../languages/languages.module';
import { TagController } from './tag.controller';
import { TagRepository } from './tag.repository';
import { TagService } from './tag.service';

/** Теги — редакційні теми новин (D17, D45); прив'язку до новини пише модуль постів (`tagIds`). */
@Module({
  imports: [LanguagesModule],
  controllers: [TagController],
  providers: [TagService, TagRepository],
})
export class TagModule {}

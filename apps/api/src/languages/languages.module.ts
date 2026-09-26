import { Module } from '@nestjs/common';
import { LanguageRepository } from './language.repository';
import { LanguageService } from './language.service';

/** Мови контенту (D8): список з БД, fallback на default (розділ 8). */
@Module({
  providers: [LanguageRepository, LanguageService],
  exports: [LanguageService],
})
export class LanguagesModule {}

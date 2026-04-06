import { IsString, IsBoolean, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PostTranslationDto } from './create-post.dto';

export class UpdatePostTranslationDto {
  @IsString()
  @IsIn(['en', 'ua'])
  language: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsOptional()
  content?: string;
}

export class UpdatePostDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostTranslationDto)
  @IsOptional()
  translations?: PostTranslationDto[];

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}
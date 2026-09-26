import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IsMediaUrl,
  IsSourceUrl,
} from '../../common/validation/url-field.decorators';

export class PostTranslationDto {
  @IsString()
  @IsIn(['en', 'ua'])
  language: string;

  @IsString()
  title: string;

  @IsString()
  excerpt: string;

  @IsString()
  content: string;
}

export class CreatePostDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostTranslationDto)
  translations: PostTranslationDto[];

  @IsMediaUrl()
  @IsOptional()
  coverImage?: string;

  @IsMediaUrl()
  @IsOptional()
  videoUrl?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @IsSourceUrl()
  @IsOptional()
  sourceUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}

import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(5)
  title: string;

  @IsString()
  @MinLength(10)
  excerpt: string;

  @IsString()
  @MinLength(20)
  content: string;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;
}
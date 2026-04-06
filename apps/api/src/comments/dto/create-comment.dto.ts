import { IsString, MinLength, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(2)
  content: string;

  // Або postId або matchId — валідація в сервісі
  @IsString()
  @IsOptional()
  postId?: string;

  @IsString()
  @IsOptional()
  matchId?: string;

  // Якщо є parentId — це відповідь на коментар
  @IsString()
  @IsOptional()
  parentId?: string;
}
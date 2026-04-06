import { IsString, MinLength, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(2)
  content: string;

  @IsString()
  postId: string;
}
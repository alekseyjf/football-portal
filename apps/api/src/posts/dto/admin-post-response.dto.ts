import { ApiProperty } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';
import { PublicAuthorDto } from '../../users/dto/public-author-response.dto';

/** Переклад у списку адмінки: мова й заголовок. */
export class AdminPostTranslationDto {
  languageCode!: string;
  title!: string;
}

/** Новина в адмінці: будь-який статус, крім видалених. */
export class AdminPostDto {
  id!: string;
  slug!: string;

  @ApiProperty({ enum: PostStatus, enumName: 'PostStatus' })
  status!: PostStatus;

  /** `null` — чернетка без дати */
  publishedAt!: Date | null;
  /** Видно на сайті зараз: запланована, чия дата настала, — теж */
  isLive!: boolean;
  coverImageUrl!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  author!: PublicAuthorDto;
  /** Усі переклади (порядок мов — як на сайті): видно, яких бракує */
  translations!: AdminPostTranslationDto[];
}

/** `DELETE /posts/{id}`: новину приховано (soft delete). */
export class DeletedPostDto {
  id!: string;
}

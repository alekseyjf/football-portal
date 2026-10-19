import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { POST_NUMBER_MAX } from '@football-portal/validation';

/** `GET /posts/{number}`: `abc` / `0` / `2147483648` → 400, а не 500 з Prisma (`Post.number` — INTEGER). */
export class PostNumberParamDto {
  /** Номер новини з URL `{slug}-{number}` */
  @ApiProperty({ type: 'integer', minimum: 1, maximum: POST_NUMBER_MAX })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POST_NUMBER_MAX)
  number!: number;
}

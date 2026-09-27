import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Тіло `POST /football/sync`. `competitionIds` — **наші slug-и** турнірів (`PL`, `CL`), не id
 * провайдера (P5-13); без поля — усі активні.
 */
export class SyncFootballDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  competitionIds?: string[];
}

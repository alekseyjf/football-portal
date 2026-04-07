import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

/** У body можна передати коди (PL, CL) або рядкові числа ("2021") — як у URL v4. */
export class SyncFootballDto {
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((v: unknown) => String(v).trim()).filter(Boolean)
      : value,
  )
  @IsString({ each: true })
  competitionIds?: string[];
}

import { ApiProperty } from '@nestjs/swagger';
import { ClubKind } from '@prisma/client';

/**
 * Клуб-посилання — формат чипа в адмінці: прив'язка новини, пошук клубів (M1.4.8). Емблема — щоб
 * розрізнити схожі назви. Не плутати з `ClubExternalRef` — id клубу в провайдера.
 */
export class ClubRefDto {
  id!: string;
  slug!: string;
  name!: string;
  crestUrl!: string | null;
}

/** Клуб або збірна. */
export class ClubDto {
  id!: string;
  slug!: string;
  name!: string;
  shortName!: string | null;
  /** Трилітерний код (`ARS`) */
  tla!: string | null;
  crestUrl!: string | null;
}

/** Учасник сезону. */
export class SeasonClubDto extends ClubDto {
  /** `NATIONAL` — збірна */
  @ApiProperty({ enum: ClubKind, enumName: 'ClubKind' })
  kind!: ClubKind;
}

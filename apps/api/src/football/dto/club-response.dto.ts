import { ApiProperty } from '@nestjs/swagger';
import { ClubKind } from '@prisma/client';

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

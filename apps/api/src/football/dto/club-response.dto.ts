import { ApiProperty } from '@nestjs/swagger';
import { ClubKind } from '@prisma/client';
import { CompetitionRefDto } from './league-response.dto';

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

// Плаский, без `extends ClubRefDto` — як `AdminLeagueDto`
/** Клуб у пошуку для форми новини: поля чипа й турніри, з яких форма підказує турніри новини (D46, D48). */
export class AdminClubSearchResultDto {
  id!: string;
  slug!: string;
  name!: string;
  crestUrl!: string | null;
  /** Турніри поточного сезону, які зараз «у грі» (D48), — у порядку редакції; порожньо — таких немає */
  competitions!: CompetitionRefDto[];
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

import { ApiProperty } from '@nestjs/swagger';
import { CompetitionType } from '@prisma/client';

/** Країна чи регіон турніру. */
export class AreaDto {
  code!: string;
  name!: string;
  flagUrl!: string | null;
}

/** Сезон турніру. `label` — «2025/26» або «2026»; у параметрі `season` — `2025-26` / `2026`. */
export class SeasonDto {
  label!: string;
  isCurrent!: boolean;
  /** Поточний тур за даними провайдера; `null` — невідомо */
  currentMatchday!: number | null;

  @ApiProperty({ format: 'date', example: '2025-08-15' })
  startDate!: string;

  @ApiProperty({ format: 'date', example: '2026-05-24' })
  endDate!: string;
}

/**
 * Турнір-посилання — формат чипа в адмінці: прив'язка новини, вибір турнірів, турніри клубу в пошуку
 * (M1.4.8). Не плутати з `CompetitionExternalRef` — id турніру в провайдера.
 */
export class CompetitionRefDto {
  id!: string;
  /** Наш код турніру (`PL`, `CL`) */
  slug!: string;
  name!: string;
}

// Плаский, без `extends CompetitionRefDto` — як `AdminPostDetailDto` (M1.4.8.1): поля відповіді й їхній
// порядок у Swagger видно в самому класі
/** Турнір у виборі турнірів новини (адмінка): поля чипа, тип і чи ввімкнений. */
export class AdminLeagueDto {
  id!: string;
  /** Наш код турніру (`PL`, `CL`) */
  slug!: string;
  name!: string;

  /** Групи вибору: `LEAGUE` — «Ліги», `CUP` — «Кубки» */
  @ApiProperty({ enum: CompetitionType, enumName: 'CompetitionType' })
  type!: CompetitionType;

  /** `false` — вимкнено редакцією: не синкається й не показується на сайті, але новину до нього прив'язати можна */
  isActive!: boolean;
}

/** Турнір. */
export class LeagueDto {
  id!: string;
  /** Наш код турніру в URL і параметрах (`PL`, `CL`) */
  slug!: string;
  name!: string;

  @ApiProperty({ enum: CompetitionType, enumName: 'CompetitionType' })
  type!: CompetitionType;

  emblemUrl!: string | null;
  area!: AreaDto | null;
  /** `null` — турнір ще не синкали */
  currentSeason!: SeasonDto | null;
  /**
   * Турнір зараз «у грі»: увімкнений, сезон поточний і ще не скінчився — є матчі попереду або від кінця сезону
   * минуло не більше 30 днів. Чемпіонат світу, що завершився, лишається поточним сезоном роками — а «у грі» вже ні
   */
  isInPlay!: boolean;
}

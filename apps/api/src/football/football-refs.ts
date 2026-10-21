import type { Prisma } from '@prisma/client';

/*
 * Турнір і клуб як посилання — формат чипа в адмінці (`CompetitionRefDto`, `ClubRefDto`, D47): один select
 * на всі відповіді з чипами — новина для форми (posts) і вибір у формі (M1.4.8.2). Окремим файлом, щоб інші
 * модулі не імпортували внутрішнє `persistence/` (clean-code Rule 2). Не плутати з `*ExternalRef` провайдера.
 */

export const COMPETITION_REF_SELECT = {
  id: true,
  slug: true,
  name: true,
} satisfies Prisma.CompetitionSelect;

export const CLUB_REF_SELECT = {
  id: true,
  slug: true,
  name: true,
  crestUrl: true,
} satisfies Prisma.ClubSelect;

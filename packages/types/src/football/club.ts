import type { ApiSchemas } from '../api-schemas';

/** Клуб або збірна — у матчах і таблицях. */
export type Club = ApiSchemas['ClubDto'];

/**
 * Клуб у пошуку адмінки — `GET /football/clubs/admin/search?search=` (D48): до 20 клубів, з короткою назвою й кодом
 * і турнірами поточного сезону «у грі».
 */
export type AdminClubSearchResult = ApiSchemas['AdminClubSearchResultDto'];

/** Клуб-чип новини в адмінці (D47) — `GET /posts/admin/{id}`. */
export type ClubRef = ApiSchemas['ClubRefDto'];

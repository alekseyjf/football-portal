import type { ApiSchemas } from '../api-schemas';

/** Ціль реакції: новина, коментар, матч. */
export type LikeTargetType = ApiSchemas['LikeTargetType'];

export type LikeType = ApiSchemas['LikeType'];

/** `GET /likes/stats/…`, відповідь `POST /likes`: лише лайки й мій голос (дизлайки бачить адмін). */
export type LikeStats = ApiSchemas['LikeStatsDto'];

/** Тіло `POST /likes`: повтор тієї ж дії знімає голос. */
export type ToggleLikeRequest = ApiSchemas['ToggleLikeDto'];

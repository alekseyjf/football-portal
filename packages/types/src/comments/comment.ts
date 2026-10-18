import type { ApiSchemas } from '../api-schemas';

/** Коментар з деревом відповідей: `GET /comments/post/{postId}`, `/comments/match/{matchId}`. */
export type Comment = ApiSchemas['CommentDto'];

/** Тіло `POST /comments`: рівно одне з `postId` / `matchId`; `parentId` — відповідь. */
export type CreateCommentRequest = ApiSchemas['CreateCommentDto'];

/** `DELETE /comments/{id}` — сховано разом з гілкою відповідей. */
export type SoftDeletedComment = ApiSchemas['SoftDeletedCommentDto'];

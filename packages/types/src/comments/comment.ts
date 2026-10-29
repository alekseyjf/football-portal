import type { ApiSchemas } from '../api-schemas';

/** Коментар з деревом відповідей: старі `GET /comments/post/{postId}`, `/comments/match/{matchId}` (до M1.7.3). */
export type Comment = ApiSchemas['CommentDto'];

/** Коментар порції (D27): корінь або відповідь у гілці; заглушка — `isDeleted`, без тексту й автора. */
export type CommentItem = ApiSchemas['CommentItemDto'];

/** Кому відповіли: відповідь на відповідь. */
export type CommentReplyTo = ApiSchemas['CommentReplyToDto'];

/** `GET /comments?postId=|matchId=&sort=`, `GET /comments/{id}/replies`: порція і курсор наступної. */
export type CommentPage = ApiSchemas['CommentPageDto'];

/** Порядок коренів (`?sort=`). */
export type CommentSort = ApiSchemas['CommentSort'];

/** Тіло `POST /comments`: рівно одне з `postId` / `matchId`; `parentId` — відповідь. Відповідь — `CommentItem`. */
export type CreateCommentRequest = ApiSchemas['CreateCommentDto'];

/** `DELETE /comments/{id}` — сховано (корінь з відповідями — заглушка). */
export type SoftDeletedComment = ApiSchemas['SoftDeletedCommentDto'];

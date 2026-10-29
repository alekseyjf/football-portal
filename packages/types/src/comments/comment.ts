import type { ApiSchemas } from '../api-schemas';

/** Коментар порції (D27): корінь або відповідь у гілці; заглушка — `isDeleted`, без тексту й автора. */
export type CommentItem = ApiSchemas['CommentItemDto'];

/** Кому відповіли: відповідь на відповідь. */
export type CommentReplyTo = ApiSchemas['CommentReplyToDto'];

/** `GET /comments/{id}/replies`: порція відповідей і курсор наступної. */
export type CommentPage = ApiSchemas['CommentPageDto'];

/** `GET /comments?postId=|matchId=&sort=`: порція коренів, курсор наступної і «N коментарів». */
export type CommentRootsPage = ApiSchemas['CommentRootsPageDto'];

/** Порядок коренів (`?sort=`). */
export type CommentSort = ApiSchemas['CommentSort'];

/** Тіло `POST /comments`: рівно одне з `postId` / `matchId`; `parentId` — відповідь. Відповідь — `CommentItem`. */
export type CreateCommentRequest = ApiSchemas['CreateCommentDto'];

/** Тіло `PATCH /comments/{id}`: новий текст свого коментаря (15 хв від публікації). Відповідь — `CommentItem`. */
export type UpdateCommentRequest = ApiSchemas['UpdateCommentDto'];

/** `DELETE /comments/{id}` — сховано (корінь з відповідями — заглушка). */
export type SoftDeletedComment = ApiSchemas['SoftDeletedCommentDto'];

import { CommentContentDto } from './comment-content.dto';

/** `PATCH /comments/:id`: новий текст свого коментаря — ті самі межі, що в нового (D27). */
export class UpdateCommentDto extends CommentContentDto {}

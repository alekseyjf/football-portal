import type { CommentDto } from './dto/comment-response.dto';

/** Коментар без відповідей — вхід для дерева (вузол дерева — `CommentDto`, форма як у v4, P4-9). */
export type PublicCommentFlat = Omit<CommentDto, 'replies'>;

/**
 * З плоского списку живих коментарів треду будує дерево (parentId → replies) — старе
 * `GET /comments/post/{postId}`, до M1.7.3. Корені: закріплені першими, далі новіші; відповіді — хронологічно.
 * Відповіді видаленого кореня (заглушки, D27) — «сироти»: вони йдуть у корені, а не зникають.
 */
export function buildCommentTreeFromFlat(
  comments: PublicCommentFlat[],
): CommentDto[] {
  const nodeById = new Map<string, CommentDto>();
  for (const comment of comments) {
    nodeById.set(comment.id, { ...comment, replies: [] });
  }

  const roots: CommentDto[] = [];
  for (const node of nodeById.values()) {
    const parentNode = node.parentId ? nodeById.get(node.parentId) : undefined;
    if (parentNode) parentNode.replies.push(node);
    else roots.push(node);
  }

  const pinWeight = (node: CommentDto) => (node.pinnedAt ? 1 : 0);
  roots.sort(
    (left, right) =>
      pinWeight(right) - pinWeight(left) ||
      right.createdAt.getTime() - left.createdAt.getTime(),
  );

  const sortRepliesDeep = (node: CommentDto) => {
    node.replies.sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    node.replies.forEach(sortRepliesDeep);
  };
  roots.forEach(sortRepliesDeep);
  return roots;
}

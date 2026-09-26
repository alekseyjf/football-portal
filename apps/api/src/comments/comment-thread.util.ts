import type { PublicAuthor } from '../users/public-author';

/** Вузол дерева коментарів у публічній відповіді (P4-9 — форма як у v4). */
export type PublicCommentNode = {
  id: string;
  content: string;
  pinnedAt: Date | null;
  createdAt: Date;
  parentId: string | null;
  author: PublicAuthor;
  replies: PublicCommentNode[];
};

export type PublicCommentFlat = Omit<PublicCommentNode, 'replies'>;

/**
 * З плоского списку живих коментарів треду будує дерево (parentId → replies).
 * Корені: закріплені першими, далі новіші; відповіді — хронологічно.
 * Під видаленим коментарем живих немає (P4-5), тож «сиріт» бути не повинно;
 * якщо все ж трапиться — вузол піде в корені, а не зникне.
 */
export function buildCommentTreeFromFlat(
  comments: PublicCommentFlat[],
): PublicCommentNode[] {
  const nodeById = new Map<string, PublicCommentNode>();
  for (const comment of comments) {
    nodeById.set(comment.id, { ...comment, replies: [] });
  }

  const roots: PublicCommentNode[] = [];
  for (const node of nodeById.values()) {
    const parentNode = node.parentId ? nodeById.get(node.parentId) : undefined;
    if (parentNode) parentNode.replies.push(node);
    else roots.push(node);
  }

  const pinWeight = (node: PublicCommentNode) => (node.pinnedAt ? 1 : 0);
  roots.sort(
    (left, right) =>
      pinWeight(right) - pinWeight(left) ||
      right.createdAt.getTime() - left.createdAt.getTime(),
  );

  const sortRepliesDeep = (node: PublicCommentNode) => {
    node.replies.sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    node.replies.forEach(sortRepliesDeep);
  };
  roots.forEach(sortRepliesDeep);
  return roots;
}

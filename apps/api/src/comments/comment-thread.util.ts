export type CommentFlatRow = {
  id: string;
  content: string;
  pinnedAt: Date | null;
  createdAt: Date;
  parentId: string | null;
  author: {
    id: string;
    name: string;
    avatar: string | null;
  };
};

export type CommentTreeNode = CommentFlatRow & {
  replies: CommentTreeNode[];
};

/**
 * З плоского списку будує дерево для одного поста/матчу (parentId → replies).
 */
export function buildCommentTreeFromFlat(
  rows: CommentFlatRow[],
): CommentTreeNode[] {
  const map = new Map<string, CommentTreeNode>();
  for (const row of rows) {
    map.set(row.id, { ...row, replies: [] });
  }

  const roots: CommentTreeNode[] = [];
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (!row.parentId) {
      roots.push(node);
      continue;
    }
    const parent = map.get(row.parentId);
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  const sortRoots = (list: CommentTreeNode[]) => {
    list.sort((left, right) => {
      const pinWeight = (node: CommentTreeNode) => (node.pinnedAt ? 1 : 0);
      const pinDiff = pinWeight(right) - pinWeight(left);
      if (pinDiff !== 0) return pinDiff;
      return right.createdAt.getTime() - left.createdAt.getTime();
    });
  };

  const sortRepliesDeep = (node: CommentTreeNode) => {
    node.replies.sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    node.replies.forEach(sortRepliesDeep);
  };

  sortRoots(roots);
  roots.forEach(sortRepliesDeep);
  return roots;
}

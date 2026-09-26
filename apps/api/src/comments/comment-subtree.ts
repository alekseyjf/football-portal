/** Рядок гілки, потрібний для purge-thread (P4-7). */
export type BranchComment = {
  id: string;
  parentId: string | null;
  depth: number;
};

export type CommentSubtree = {
  /** Усі id піддерева (разом з ціллю) — блокуються до видалення */
  commentIds: string[];
  /** Рівні піддерева, найглибший першим: так `Restrict` на parent/root не спрацьовує */
  levelsDeepestFirst: string[][];
};

/**
 * Піддерево `targetId` з рядків усієї гілки (корінь + `rootId = корінь`).
 * `rootId` дає піддерево лише для кореня; для відповіді нащадків шукаємо за `parentId`.
 * Лише структура: чи рядок живий, читається вже під блокуванням (`lockForWrite`), бо
 * паралельний soft delete міг змінити його після читання гілки.
 * `null`, якщо цілі серед рядків немає.
 */
export function collectCommentSubtree(
  branchComments: BranchComment[],
  targetId: string,
): CommentSubtree | null {
  const target = branchComments.find((comment) => comment.id === targetId);
  if (!target) return null;

  const childrenByParentId = new Map<string, BranchComment[]>();
  for (const comment of branchComments) {
    if (!comment.parentId) continue;
    const siblings = childrenByParentId.get(comment.parentId) ?? [];
    siblings.push(comment);
    childrenByParentId.set(comment.parentId, siblings);
  }

  const commentIds: string[] = [];
  const idsByDepth = new Map<number, string[]>();
  const pending = [target];
  while (pending.length > 0) {
    const comment = pending.pop()!;
    commentIds.push(comment.id);
    const levelIds = idsByDepth.get(comment.depth) ?? [];
    levelIds.push(comment.id);
    idsByDepth.set(comment.depth, levelIds);
    pending.push(...(childrenByParentId.get(comment.id) ?? []));
  }

  const levelsDeepestFirst = [...idsByDepth.entries()]
    .sort(([leftDepth], [rightDepth]) => rightDepth - leftDepth)
    .map(([, levelIds]) => levelIds);
  return { commentIds, levelsDeepestFirst };
}

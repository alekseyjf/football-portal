import type { PublicCommentFlat } from './comment-thread.util';
import { buildCommentTreeFromFlat } from './comment-thread.util';

const author = { id: 'author', name: 'Fan', avatarUrl: null, isDeleted: false };

function comment(
  id: string,
  parentId: string | null,
  createdAtMinute: number,
  isPinned = false,
): PublicCommentFlat {
  const createdAt = new Date(Date.UTC(2026, 8, 26, 12, createdAtMinute));
  return {
    id,
    content: `comment ${id}`,
    pinnedAt: isPinned ? createdAt : null,
    createdAt,
    parentId,
    author,
  };
}

describe('buildCommentTreeFromFlat', () => {
  it('корені: закріплені першими, далі новіші; відповіді — хронологічно, вкладено', () => {
    const tree = buildCommentTreeFromFlat([
      comment('laterReply', 'older', 5),
      comment('older', null, 1),
      comment('pinned', null, 0, true),
      comment('newer', null, 3),
      comment('earlyReply', 'older', 2),
      comment('nested', 'earlyReply', 4),
    ]);
    expect(tree.map((node) => node.id)).toEqual(['pinned', 'newer', 'older']);
    const olderNode = tree[2];
    expect(olderNode.replies.map((node) => node.id)).toEqual([
      'earlyReply',
      'laterReply',
    ]);
    expect(olderNode.replies[0].replies.map((node) => node.id)).toEqual([
      'nested',
    ]);
  });

  it('вузол без батька у вибірці не губиться — іде в корені', () => {
    const tree = buildCommentTreeFromFlat([comment('orphan', 'missing', 1)]);
    expect(tree.map((node) => node.id)).toEqual(['orphan']);
  });
});

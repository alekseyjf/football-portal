import { collectCommentSubtree, type BranchComment } from './comment-subtree';

function comment(
  id: string,
  parentId: string | null,
  depth: number,
): BranchComment {
  return { id, parentId, depth };
}

/**
 * root
 * ├── first            (depth 1)
 * │   ├── firstChild   (depth 2)
 * │   │   └── deepest  (depth 3)
 * │   └── secondChild  (depth 2)
 * └── second           (depth 1)
 *     └── foreign      (depth 2) — чужа гілка для `first`
 */
const branch: BranchComment[] = [
  comment('root', null, 0),
  comment('first', 'root', 1),
  comment('firstChild', 'first', 2),
  comment('deepest', 'firstChild', 3),
  comment('secondChild', 'first', 2),
  comment('second', 'root', 1),
  comment('foreign', 'second', 2),
];

const sortedLevels = (levels: string[][] | undefined) =>
  levels?.map((levelIds) => [...levelIds].sort());

describe('collectCommentSubtree', () => {
  it('корінь — уся гілка, рівні від найглибшого', () => {
    const subtree = collectCommentSubtree(branch, 'root');
    expect(sortedLevels(subtree?.levelsDeepestFirst)).toEqual([
      ['deepest'],
      ['firstChild', 'foreign', 'secondChild'],
      ['first', 'second'],
      ['root'],
    ]);
    expect(subtree?.commentIds).toHaveLength(7);
  });

  it('відповідь (не корінь) — лише її піддерево, без чужих гілок того ж rootId', () => {
    const subtree = collectCommentSubtree(branch, 'first');
    expect(sortedLevels(subtree?.levelsDeepestFirst)).toEqual([
      ['deepest'],
      ['firstChild', 'secondChild'],
      ['first'],
    ]);
    expect([...(subtree?.commentIds ?? [])].sort()).toEqual([
      'deepest',
      'first',
      'firstChild',
      'secondChild',
    ]);
  });

  it('листок — один рівень', () => {
    expect(collectCommentSubtree(branch, 'foreign')).toEqual({
      commentIds: ['foreign'],
      levelsDeepestFirst: [['foreign']],
    });
  });

  it('цілі немає серед рядків → null', () => {
    expect(collectCommentSubtree(branch, 'missing')).toBeNull();
  });
});

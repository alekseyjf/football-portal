import { PostStatus } from '@prisma/client';
import {
  POST_PUBLISHED_EVENT,
  POST_UNPUBLISHED_EVENT,
  POST_UPDATED_EVENT,
  postEvents,
  type PostEventState,
} from './post-events';

const POST = { id: 'post-1', number: 42, slug: 'arsenal-win-the-derby' };

function stateWith(status: PostStatus, slug = POST.slug): PostEventState {
  return { ...POST, slug, status };
}

describe('postEvents — новина з’явилась, змінилась чи зникла (D57)', () => {
  it('стала PUBLISHED — `post.published`: створення, з чернетки, із запланованої, з архіву', () => {
    for (const before of [
      null,
      stateWith(PostStatus.DRAFT),
      stateWith(PostStatus.SCHEDULED),
      stateWith(PostStatus.ARCHIVED),
    ]) {
      expect(postEvents(before, stateWith(PostStatus.PUBLISHED))).toEqual([
        { name: POST_PUBLISHED_EVENT, post: POST },
      ]);
    }
  });

  it('перестала бути живою — `post.unpublished`: в архів, у чернетки, видалили', () => {
    for (const after of [
      stateWith(PostStatus.ARCHIVED),
      stateWith(PostStatus.DRAFT),
      null,
    ]) {
      expect(postEvents(stateWith(PostStatus.PUBLISHED), after)).toEqual([
        { name: POST_UNPUBLISHED_EVENT, post: POST },
      ]);
    }
  });

  it('жива змінила те, що бачить читач, — `post.updated` з поточною адресою (і новий slug: стара — 308)', () => {
    const renamed = stateWith(PostStatus.PUBLISHED, 'derby-report');
    expect(postEvents(stateWith(PostStatus.PUBLISHED), renamed, true)).toEqual([
      { name: POST_UPDATED_EVENT, post: { ...POST, slug: 'derby-report' } },
    ]);
  });

  it('на сайті нічого не змінилось — подій немає: збереження без змін, чернетка ↔ запланована, видалили чернетку', () => {
    expect(
      postEvents(
        stateWith(PostStatus.PUBLISHED),
        stateWith(PostStatus.PUBLISHED),
        false,
      ),
    ).toEqual([]);
    expect(
      postEvents(
        stateWith(PostStatus.DRAFT),
        stateWith(PostStatus.SCHEDULED, 'new-slug'),
        true,
      ),
    ).toEqual([]);
    expect(postEvents(stateWith(PostStatus.DRAFT), null)).toEqual([]);
    expect(postEvents(null, stateWith(PostStatus.SCHEDULED))).toEqual([]);
  });
});

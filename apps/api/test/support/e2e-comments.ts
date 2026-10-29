import request from 'supertest';
import { apiPath } from './e2e-app';
import { expectMatchesContract } from './openapi-contract';

/** Коментар порції — поля, які перевіряють тести (повна форма — контракт). */
export interface CommentItemBody {
  id: string;
  parentId: string | null;
  content: string | null;
  author: { id: string; name: string } | null;
  isDeleted: boolean;
  likeCount: number;
  myReaction: 'LIKE' | 'DISLIKE' | null;
  replyCount: number;
  replyTo: {
    commentId: string | null;
    author: { id: string; name: string } | null;
  } | null;
}

export interface CommentPageBody {
  items: CommentItemBody[];
  nextCursor: string | null;
}

export interface CommentRootsPageBody extends CommentPageBody {
  commentCount: number;
}

/** Агент з сесією або гість (`request(server)`): обидва вміють `get` / `post`. */
type Client = request.Agent | ReturnType<typeof request>;

export async function postComment(
  agent: request.Agent,
  body: Record<string, string>,
): Promise<CommentItemBody> {
  const response = await agent
    .post(apiPath('/comments'))
    .send(body)
    .expect(201);
  expectMatchesContract(response, 'post', '/comments');
  return response.body as CommentItemBody;
}

export async function getRootsPage(
  client: Client,
  query: Record<string, string | number>,
): Promise<CommentRootsPageBody> {
  const response = await client
    .get(apiPath('/comments'))
    .query(query)
    .expect(200);
  expectMatchesContract(response, 'get', '/comments');
  return response.body as CommentRootsPageBody;
}

export async function getRepliesPage(
  client: Client,
  rootId: string,
  query: Record<string, string | number> = {},
): Promise<CommentPageBody> {
  const response = await client
    .get(apiPath(`/comments/${rootId}/replies`))
    .query(query)
    .expect(200);
  expectMatchesContract(response, 'get', '/comments/{id}/replies');
  return response.body as CommentPageBody;
}

/** Усі порції підряд — id у порядку видачі. */
export async function collectAllIds(
  readPage: (cursor: string | null) => Promise<CommentPageBody>,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const page = await readPage(cursor);
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor;
  } while (cursor !== null);
  return ids;
}

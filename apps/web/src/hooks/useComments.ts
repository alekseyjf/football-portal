import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/http';
import type {
  CommentItem,
  CommentPage,
  CommentRootsPage,
  CommentSort,
  CreateCommentRequest,
  SoftDeletedComment,
  UpdateCommentRequest,
} from '@/lib/api/types';
import {
  appendOwnReply,
  countOwnReply,
  prependOwnRoot,
  updateCommentInPages,
  type CommentPages,
} from '@/lib/comments/comment-pages';

/** Порядок коренів — лише «Нові», завжди явно (D27); «Популярні» — M2.14. */
const COMMENT_SORT: CommentSort = 'newest';
const COMMENTS_STALE_TIME_MS = 30 * 1000;

/** Порції (D27) — явно в `limit`: скелетон наступної порції відповідей знає, скільки карток прийде. */
export const COMMENT_ROOTS_PAGE_SIZE = 20;
export const COMMENT_REPLIES_PAGE_SIZE = 10;

/** Усі порції коментарів новини — під одним префіксом: лайк і видалення знаходять коментар у будь-якій. */
export const commentsQueryKey = (postId: string) =>
  ['comments', 'post', postId] as const;

export const commentRootsQueryKey = (postId: string) =>
  [...commentsQueryKey(postId), 'roots', COMMENT_SORT] as const;

export const commentRepliesQueryKey = (postId: string, rootId: string) =>
  [...commentsQueryKey(postId), 'replies', rootId] as const;

function withCursor(params: URLSearchParams, cursor: string | null): string {
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

/** Корені новини порціями по 20 («Показати ще»); `enabled` — секцію вже видно (вантажимо ліниво, не в SSR). */
export function useCommentRoots(postId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: commentRootsQueryKey(postId),
    queryFn: ({ pageParam }) =>
      apiGet<CommentRootsPage>(
        `/comments?${withCursor(
          new URLSearchParams({
            postId,
            sort: COMMENT_SORT,
            limit: String(COMMENT_ROOTS_PAGE_SIZE),
          }),
          pageParam,
        )}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    staleTime: COMMENTS_STALE_TIME_MS,
  });
}

/** Відповіді гілки порціями по 10, від старих до нових — лише розгорнутої. */
export function useCommentReplies(postId: string, rootId: string) {
  return useInfiniteQuery({
    queryKey: commentRepliesQueryKey(postId, rootId),
    queryFn: ({ pageParam }) =>
      apiGet<CommentPage>(
        `/comments/${encodeURIComponent(rootId)}/replies?${withCursor(
          new URLSearchParams({ limit: String(COMMENT_REPLIES_PAGE_SIZE) }),
          pageParam,
        )}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: COMMENTS_STALE_TIME_MS,
  });
}

/**
 * Свій коментар — новий чи змінений — у кеш порцій без перезапиту (D27). Запит порцій, що вже летить, міг початись
 * до запису й затер би його — скасовуємо; порцій ще немає (перша не прийшла чи її скасовано) — перечитуємо.
 */
async function writeIntoPages<Page extends CommentPage>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  write: (data: CommentPages<Page>) => CommentPages<Page>,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey, exact: true });
  if (queryClient.getQueryData(queryKey) === undefined) {
    await queryClient.invalidateQueries({ queryKey, exact: true });
    return;
  }
  queryClient.setQueryData<CommentPages<Page>>(
    queryKey,
    (data) => data && write(data),
  );
}

/** Коментар або відповідь (`parentId`): корінь — нагорі, відповідь — у кінці розгорнутої гілки. */
export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCommentRequest) =>
      apiPost<CommentItem>('/comments', body),
    onSuccess: async (comment) => {
      const rootsKey = commentRootsQueryKey(postId);
      if (comment.parentId === null) {
        await writeIntoPages<CommentRootsPage>(queryClient, rootsKey, (data) =>
          prependOwnRoot(data, comment),
        );
        return;
      }
      const rootId = comment.parentId;
      await Promise.all([
        writeIntoPages<CommentRootsPage>(queryClient, rootsKey, (data) =>
          countOwnReply(data, rootId),
        ),
        writeIntoPages(
          queryClient,
          commentRepliesQueryKey(postId, rootId),
          (data) => appendOwnReply(data, comment),
        ),
      ]);
    },
  });
}

type CommentEdit = { comment: CommentItem; content: string };

/**
 * Новий текст свого коментаря (M1.7.4): відповідь API — з `editedAt` — замінює коментар у порції, де він є
 * (корінь — у порціях коренів, відповідь — у своїй гілці), без перезапиту.
 */
export function useEditComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ comment, content }: CommentEdit) =>
      apiPatch<CommentItem>(`/comments/${encodeURIComponent(comment.id)}`, {
        content,
      } satisfies UpdateCommentRequest),
    onSuccess: (edited) =>
      writeIntoPages(
        queryClient,
        edited.parentId === null
          ? commentRootsQueryKey(postId)
          : commentRepliesQueryKey(postId, edited.parentId),
        (data) => updateCommentInPages(data, edited.id, () => edited),
      ),
  });
}

/**
 * Видалити свій (або, адміну, будь-який) коментар. Що лишиться — заглушка, зник корінь, лічильники — вирішує API (D27),
 * тож порції коренів і гілки перечитуємо, а не повторюємо правила в клієнті; і після помилки (вже видалено) теж.
 */
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comment: CommentItem) =>
      apiDelete<SoftDeletedComment>(
        `/comments/${encodeURIComponent(comment.id)}`,
      ),
    onSettled: (_result, _error, comment) => {
      const rootId = comment.parentId ?? comment.id;
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: commentRootsQueryKey(postId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: commentRepliesQueryKey(postId, rootId),
          exact: true,
        }),
      ]);
    },
  });
}

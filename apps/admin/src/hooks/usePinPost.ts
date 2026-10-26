import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost } from '@/lib/api/http';
import type {
  AdminPost,
  AdminPostDetail,
  PaginatedAdminPosts,
  PinnedAdminPost,
  PinPostRequest,
} from '@/lib/api/types';
import { pinnedAfterChange, withCurrentPinned, withPinChange, type PinState } from '@/lib/pinnedPost';

/** Закріплена головна новина (`GET /posts/admin/pinned`). Ключ — під `['admin', 'posts']`: мутації новин скидають і її. */
export function pinnedPostQueryOptions() {
  return queryOptions({
    queryKey: ['admin', 'posts', 'pinned'] as const,
    queryFn: () => apiGet<PinnedAdminPost>('/posts/admin/pinned'),
  });
}

type CachedPostUpdate = <Post extends PinState>(post: Post) => Post;

/** Те саме оновлення закріплення — кожній новині в кеші: рядкам усіх сторінок списку й новинам для форми. */
function updateCachedPosts(queryClient: QueryClient, update: CachedPostUpdate) {
  queryClient.setQueriesData<PaginatedAdminPosts>(
    { queryKey: ['admin', 'posts', 'list'] },
    (page) => page && { ...page, data: page.data.map(update) },
  );
  queryClient.setQueriesData<AdminPostDetail>({ queryKey: ['admin', 'posts', 'detail'] }, (post) => post && update(post));
}

/**
 * Закріплена саме зараз — з API, а не з кешу: від неї залежить, про яку заміну питати. Відповідь заодно виправляє
 * кеш: закріпити могли з іншої вкладки чи інший редактор.
 */
export async function fetchCurrentPinnedPost(queryClient: QueryClient): Promise<PinnedAdminPost> {
  const pinned = await queryClient.fetchQuery({ ...pinnedPostQueryOptions(), staleTime: 0 });
  updateCachedPosts(queryClient, (post) => withCurrentPinned(post, pinned.post));
  return pinned;
}

/** Рядок з відповіді `POST` / `DELETE /posts/{id}/pin` — у кеш списку, новин для форми й закріпленої (D56). */
function applyPinChange(queryClient: QueryClient, changedPost: AdminPost) {
  updateCachedPosts(queryClient, (post) => withPinChange(post, changedPost));
  queryClient.setQueryData<PinnedAdminPost>(pinnedPostQueryOptions().queryKey, (current) =>
    pinnedAfterChange(current, changedPost),
  );
}

/** `POST /posts/{id}/pin` — закріпити замість `replacesPostId` (його редактор бачив у підтвердженні). */
export function usePinPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, ...body }: PinPostRequest & { postId: string }) =>
      apiPost<AdminPost>(`/posts/${encodeURIComponent(postId)}/pin`, body),
    onSuccess: (changedPost) => applyPinChange(queryClient, changedPost),
  });
}

/** `DELETE /posts/{id}/pin` — відкріпити: головною на сайті стане найсвіжіша. */
export function useUnpinPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => apiDelete<AdminPost>(`/posts/${encodeURIComponent(postId)}/pin`),
    onSuccess: (changedPost) => applyPinChange(queryClient, changedPost),
  });
}

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/http';
import type { LikeStatsResponse, LikeTargetType } from '@/lib/api/types';

export function likeStatsQueryKey(
  targetType: LikeTargetType,
  targetId: string,
) {
  return ['likes', 'stats', targetType, targetId] as const;
}

export function likeStatsQueryOptions(
  targetType: LikeTargetType,
  targetId: string,
) {
  return {
    queryKey: likeStatsQueryKey(targetType, targetId),
    queryFn: () =>
      apiGet<LikeStatsResponse>(
        `/likes/stats/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
      ),
    staleTime: 30 * 1000,
  };
}

export function useLikeStats(targetType: LikeTargetType, targetId: string) {
  return useQuery(likeStatsQueryOptions(targetType, targetId));
}

export type ToggleLikePayload = {
  targetType: LikeTargetType;
  targetId: string;
  action: 'LIKE' | 'DISLIKE';
};

export function applyOptimisticLikeToggle(
  state: LikeStatsResponse,
  action: 'LIKE' | 'DISLIKE',
): LikeStatsResponse {
  const { myReaction, likesCount } = state;
  if (action === 'LIKE') {
    if (myReaction === 'LIKE') {
      return {
        ...state,
        likesCount: Math.max(0, likesCount - 1),
        myReaction: null,
      };
    }
    if (myReaction === 'DISLIKE') {
      return {
        ...state,
        likesCount: likesCount + 1,
        myReaction: 'LIKE',
      };
    }
    return { ...state, likesCount: likesCount + 1, myReaction: 'LIKE' };
  }
  if (myReaction === 'DISLIKE') {
    return {
      ...state,
      myReaction: null,
    };
  }
  if (myReaction === 'LIKE') {
    return {
      ...state,
      likesCount: Math.max(0, likesCount - 1),
      myReaction: 'DISLIKE',
    };
  }
  return { ...state, myReaction: 'DISLIKE' };
}

export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ToggleLikePayload) =>
      apiPost<LikeStatsResponse>('/likes', body),
    onMutate: async (body) => {
      const queryKey = likeStatsQueryKey(body.targetType, body.targetId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LikeStatsResponse>(queryKey);
      if (previous) {
        queryClient.setQueryData(
          queryKey,
          applyOptimisticLikeToggle(previous, body.action),
        );
      }
      return { previous, queryKey };
    },
    onError: (_error, _body, context) => {
      if (context?.previous !== undefined && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSuccess: (data, body) => {
      queryClient.setQueryData(
        likeStatsQueryKey(body.targetType, body.targetId),
        data,
      );
    },
  });
}

/** Для prefetch на сервері (опційно). */
export async function prefetchLikeStats(
  queryClient: QueryClient,
  targetType: LikeTargetType,
  targetId: string,
) {
  await queryClient.prefetchQuery(likeStatsQueryOptions(targetType, targetId));
}

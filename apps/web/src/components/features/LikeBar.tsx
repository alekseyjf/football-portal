'use client';

import { useLikeStats, useToggleLike } from '@/hooks/useLikes';
import type { LikeTargetType } from '@/lib/api/types';
import { LikeButtons } from './LikeButtons';

type Props = {
  /** Новина чи матч; коментар — `CommentLikeBar` (голоси приходять з порцією, D27) */
  targetType: Exclude<LikeTargetType, 'comment'>;
  targetId: string;
  className?: string;
};

export function LikeBar({ targetType, targetId, className }: Props) {
  const { data, isLoading } = useLikeStats(targetType, targetId);
  const { mutateAsync: toggleLike, isPending } = useToggleLike();

  return (
    <LikeButtons
      targetKey={`${targetType}:${targetId}`}
      likesCount={data?.likesCount ?? 0}
      myReaction={data?.myReaction ?? null}
      isLoading={isLoading}
      isPending={isPending}
      className={className}
      onReact={(action) => toggleLike({ targetType, targetId, action })}
    />
  );
}

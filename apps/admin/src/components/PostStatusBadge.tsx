import { adminPostStatusLabel, type AdminPost } from '@/lib/api/types';

const STATUS_BADGE_CLASS: Record<string, string> = {
  Published: 'bg-green-600/20 text-green-400',
  Scheduled: 'bg-amber-500/20 text-amber-300',
  Draft: 'bg-gray-700 text-gray-400',
  Archived: 'bg-gray-800 text-gray-500',
};

/** Статус новини, як його бачить редактор: запланована, чий час настав, — уже Published. */
export function PostStatusBadge({ post }: { post: Pick<AdminPost, 'isLive' | 'status'> }) {
  const statusLabel = adminPostStatusLabel(post);
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${STATUS_BADGE_CLASS[statusLabel]}`}>{statusLabel}</span>
  );
}

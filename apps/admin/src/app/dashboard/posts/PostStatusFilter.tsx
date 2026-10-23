import { POST_LIST_STATUSES, postListHref, type PostListParams, type PostStatus } from '@/lib/postListParams';
import { PostListLink } from './PostListLink';

/** Як бачить редактор: «Published» — і запланована, чий час настав (D47). */
export const POST_STATUS_FILTER_LABELS: Record<PostStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const STATUS_FILTERS: ReadonlyArray<{ status: PostStatus | null; label: string }> = [
  { status: null, label: 'All' },
  ...POST_LIST_STATUSES.map((status) => ({ status, label: POST_STATUS_FILTER_LABELS[status] })),
];

/**
 * Фільтр за статусом (D50) — посилання `?status=` (нова вкладка, «Назад»), без лічильників: API їх не віддає, а
 * п'ять запитів заради чисел — забагато. Новий фільтр — з першої сторінки, пошук лишається.
 */
export function PostStatusFilter({ params }: { params: PostListParams }) {
  return (
    <nav aria-label="Filter posts by status">
      <ul className="flex flex-wrap gap-1 rounded-lg bg-gray-900 p-1 text-sm">
        {STATUS_FILTERS.map(({ status, label }) => {
          const isCurrent = status === params.status;
          return (
            <li key={label}>
              <PostListLink
                href={postListHref({ ...params, status, page: 1 })}
                aria-current={isCurrent ? 'page' : undefined}
                className={`block rounded-md px-3 py-1.5 transition-colors ${
                  isCurrent ? 'bg-gray-700 font-medium text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </PostListLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import { AdminLink } from '@/components/AdminLink';
import { PostStatusBadge } from '@/components/PostStatusBadge';
import { POST_FORM_LANGUAGES } from '@/components/post-form/postFormSchema';
import { adminAuthorName, adminPostTitle, type AdminPost } from '@/lib/api/types';
import { formatEditorDateTime } from '@/lib/editorDateTime';
import { publicPostUrl } from '@/lib/publicWebUrl';

const LINK_CLASS = 'text-sm text-green-400 transition-colors hover:text-green-300';

/** Дата публікації (для запланованих — коли вийде), для чернеток — створення; у поясі редактора. */
function postDateLine(post: AdminPost, timeZone: string): string {
  const format = (isoDate: string) => formatEditorDateTime(isoDate, timeZone);
  if (post.publishedAt && post.status === 'SCHEDULED' && !post.isLive) {
    return `Goes live ${format(post.publishedAt)}`;
  }
  if (post.publishedAt) return `Published ${format(post.publishedAt)}`;
  return `Created ${format(post.createdAt)}`;
}

/** Мови новини — EN ✓ / UK ✗: якої версії бракує, видно зі списку. */
function PostLanguages({ post }: { post: AdminPost }) {
  return (
    <span className="inline-flex gap-2">
      {POST_FORM_LANGUAGES.map((language) => {
        const hasTranslation = post.translations.some((translation) => translation.languageCode === language);
        return (
          <span key={language} className={hasTranslation ? 'text-gray-300' : 'text-gray-500'}>
            {language.toUpperCase()}
            <span aria-hidden="true">{hasTranslation ? ' ✓' : ' ✗'}</span>
            {!hasTranslation && <span className="sr-only"> (missing)</span>}
          </span>
        );
      })}
    </span>
  );
}

export function PostListRow({ post, timeZone }: { post: AdminPost; timeZone: string }) {
  const title = adminPostTitle(post);
  return (
    <li className="flex flex-col gap-3 rounded-xl bg-gray-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {/* До 640 px дії — під заголовком: поруч з ними на 320 px від заголовка лишалось кілька літер */}
      <div className="min-w-0 sm:flex-1">
        <h2 className="truncate font-medium" title={title}>
          {title}
        </h2>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-gray-400">
          <span>{postDateLine(post, timeZone)}</span>
          <span aria-hidden="true">·</span>
          <span>{adminAuthorName(post.author)}</span>
          <span aria-hidden="true">·</span>
          <PostLanguages post={post} />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <PostStatusBadge post={post} />
        {/* Назва новини — для екранного диктора: інакше в переліку посилань — двадцять однакових «Edit».
            Без prefetch: кожен фільтр і сторінка дають до 20 нових посилань, по два запити prefetch на кожне, а
            вміст сторінки редагування однаково вантажить React Query */}
        <AdminLink href={`/dashboard/posts/${post.id}`} prefetch={false} className={LINK_CLASS}>
          Edit<span className="sr-only"> “{title}”</span>
        </AdminLink>
        {/* Лише для живих: чернетка / запланований на сайті — 404 */}
        {post.isLive && (
          <a href={publicPostUrl(post)} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            View on site<span className="sr-only"> “{title}” (opens in a new tab)</span>
          </a>
        )}
      </div>
    </li>
  );
}

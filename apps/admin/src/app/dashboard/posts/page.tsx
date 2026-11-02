import { Suspense } from 'react';
import { AdminLink } from '@/components/AdminLink';
import { PostListLoading } from './PostListStates';
import { PostsListView } from './PostsListView';

/**
 * Статична оболонка (D50): фільтр, пошук і сторінка — в адресі, їх читає `PostsListView` на клієнті й міняє через
 * `history.pushState` без запитів до сервера; `Suspense` — бо адресу (`useSearchParams`) знає лише браузер, а збірка
 * віддає оболонку зі «Loading posts…». До Next 16.4.3 сторінка була динамічною (`connection()`): роутер
 * підставляв query першого завантаження в кожен перехід на `/dashboard/posts` (vercel/next.js#92187).
 */
export default function PostsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">📰 Posts</h1>
        <AdminLink
          href="/dashboard/posts/create"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-green-500"
        >
          + New Post
        </AdminLink>
      </div>
      <Suspense fallback={<PostListLoading />}>
        <PostsListView />
      </Suspense>
    </main>
  );
}

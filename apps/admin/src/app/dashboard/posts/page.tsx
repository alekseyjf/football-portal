import { connection } from 'next/server';
import { AdminLink } from '@/components/AdminLink';
import { PostsListView } from './PostsListView';

/**
 * Динамічна, а не статична (D50): у Next 16.2 роутер кешує статичну сторінку під адресою з query її першого
 * завантаження — відкрита як `?status=SCHEDULED`, вона потім підставляла цей фільтр у кожен перехід на
 * `/dashboard/posts` (меню, після створення; vercel/next.js#92187). Фільтр, пошук і сторінки однаково йдуть
 * через `history.pushState` — без запитів до сервера.
 */
export default async function PostsPage() {
  await connection();
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
      <PostsListView />
    </main>
  );
}

import Link from 'next/link';
import { api } from '@/lib/api/client';

interface Post {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  createdAt: string;
  author: { name: string };
}

async function getPosts(): Promise<Post[]> {
  try {
    return await api.get<Post[]>('/posts/admin/all');
  } catch {
    return [];
  }
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📰 Posts</h1>
        <Link
          href="/dashboard/posts/create"
          className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-4">📭</p>
          <p>No posts yet.</p>
          <Link href="/dashboard/posts/create" className="text-green-400 hover:text-green-300 mt-2 inline-block">
            Create your first post →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="bg-gray-900 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">{post.title}</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {new Date(post.createdAt).toLocaleDateString('en-GB')} · {post.author.name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${post.published ? 'bg-green-600/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                  {post.published ? 'Published' : 'Draft'}
                </span>
                <Link
                  href={`/dashboard/posts/${post.id}/edit`}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
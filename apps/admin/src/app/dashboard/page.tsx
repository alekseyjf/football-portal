import Link from 'next/link';
import { FootballSyncButton } from '@/components/FootballSyncButton';
import { getPublicWebUrl } from '@/lib/publicWebUrl';

export default function DashboardPage() {
  const publicWeb = getPublicWebUrl();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">⚙️ Dashboard</h1>
        <Link
          href={publicWeb}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Публічний сайт →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/posts"
          className="bg-gray-900 hover:bg-gray-800 rounded-xl p-6 transition-colors"
        >
          <div className="text-3xl mb-3">📰</div>
          <h2 className="text-lg font-semibold mb-1">Posts</h2>
          <p className="text-gray-400 text-sm">Create and manage news posts</p>
        </Link>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-3xl mb-3">⚽</div>
          <h2 className="text-lg font-semibold mb-1">Football data</h2>
          <p className="text-gray-400 text-sm mb-4">
            Імпорт з football-data.org у PostgreSQL (ліга, матчі, таблиця).
          </p>
          <FootballSyncButton />
        </div>
      </div>
    </main>
  );
}
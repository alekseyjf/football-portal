import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">⚙️ Dashboard</h1>
        <Link
          href="http://localhost:3000"
          target="_blank"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          View Site →
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

        <div className="bg-gray-900/50 rounded-xl p-6 opacity-50 cursor-not-allowed">
          <div className="text-3xl mb-3">⚽</div>
          <h2 className="text-lg font-semibold mb-1">Matches</h2>
          <p className="text-gray-400 text-sm">Coming soon</p>
        </div>
      </div>
    </main>
  );
}
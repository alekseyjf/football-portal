import Link from 'next/link';
import { routing } from '@/i18n/routing';

export default function NotFound() {
  const defaultLocale = routing.defaultLocale;
  return (
    <main className="min-h-[60vh] flex items-center justify-center text-center px-4 bg-gray-950 text-white">
      <div>
        <p className="text-6xl mb-4">⚽</p>
        <h1 className="text-3xl font-bold mb-2">Page not found</h1>
        <p className="text-gray-400 mb-6">The page you are looking for does not exist.</p>
        <Link
          href={`/${defaultLocale}`}
          className="inline-block bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

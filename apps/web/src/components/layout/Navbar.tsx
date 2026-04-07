import Link from 'next/link';
import { NavbarClient } from '@/components/layout/NavbarClient';

export function Navbar() {
  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold flex items-center gap-2">
          ⚽ <span>Football Portal</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">News</Link>
          <Link href="/leagues" className="hover:text-white transition-colors">Leagues</Link>
          <Link href="/clubs" className="hover:text-white transition-colors">Clubs</Link>
        </nav>

        <NavbarClient />
      </div>
    </header>
  );
}
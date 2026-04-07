import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { QueryProviders } from '@/providers/QueryProvider';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Football Portal',
    template: '%s | Football Portal',
  },
  description: 'Football news, matches and clubs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <QueryProviders>
          <div className="min-h-screen bg-gray-950 text-white">
            <Navbar />
            {children}
          </div>
        </QueryProviders>
      </body>
    </html>
  );
}
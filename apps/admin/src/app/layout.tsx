import type { Metadata } from 'next';
import { QueryProviders } from '@/providers/QueryProvider';
import { UnsavedChangesProvider } from '@/providers/UnsavedChangesProvider';
import './globals.css';

export const metadata: Metadata = { title: 'Admin | Football Portal' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProviders>
          <UnsavedChangesProvider>
            <div className="min-h-screen bg-gray-950 text-white">{children}</div>
          </UnsavedChangesProvider>
        </QueryProviders>
      </body>
    </html>
  );
}
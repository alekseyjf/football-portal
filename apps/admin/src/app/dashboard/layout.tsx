import { AdminShellBar } from '@/components/AdminShellBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminShellBar />
      {children}
    </>
  );
}

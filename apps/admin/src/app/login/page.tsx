import { AdminLoginForm } from './AdminLoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">⚙️ Admin Panel</h1>
          <p className="text-gray-400 mt-2">Football Portal</p>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}
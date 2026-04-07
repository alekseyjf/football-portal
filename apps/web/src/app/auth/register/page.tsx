import { Metadata } from 'next';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Register' };

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">⚽ Football Portal</h1>
          <p className="text-gray-400 mt-2">Create your account</p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
import { CreatePostForm } from './CreatePostForm';

export default function CreatePostPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">✏️ Create Post</h1>
      <CreatePostForm />
    </main>
  );
}
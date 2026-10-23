import { EditPostView } from './EditPostView';

type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <EditPostView postId={id} />
    </main>
  );
}

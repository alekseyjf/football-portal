import { TagsView } from './TagsView';

/** Теги новин (D45): створити, перейменувати, видалити — з адмінки, без Swagger. */
export default function TagsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">🏷️ Tags</h1>
      <p className="mb-6 mt-2 text-sm text-gray-400">
        Topics of news posts: transfers, injuries, match reports. Clubs and competitions have their own fields in the
        post form — don’t make tags for them.
      </p>
      <TagsView />
    </main>
  );
}

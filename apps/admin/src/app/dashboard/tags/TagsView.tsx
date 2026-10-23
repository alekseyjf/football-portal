'use client';

import { useMemo } from 'react';
import { useAdminTags } from '@/hooks/useAdminTags';
import { sortTagsByTitle } from '@/lib/tagNames';
import { CreateTagForm } from './CreateTagForm';
import { TagListSection } from './TagListSection';

const NEW_TAG_HEADING_ID = 'new-tag-heading';

/** Теги (D45): новий — зверху, під ним усі теги з фільтром, перейменуванням і видаленням. */
export function TagsView() {
  const { data, isPending, refetch } = useAdminTags();
  const tags = useMemo(() => sortTagsByTitle(data ?? []), [data]);

  return (
    <>
      <section aria-labelledby={NEW_TAG_HEADING_ID} className="mb-10 rounded-xl border border-gray-800 p-4 sm:p-6">
        <h2 id={NEW_TAG_HEADING_ID} className="mb-4 text-lg font-semibold">
          New tag
        </h2>
        <CreateTagForm tags={tags} />
      </section>
      <TagListSection
        tags={tags}
        isPending={isPending}
        // Дані є — показуємо їх, навіть коли фонове оновлення впало
        hasFailed={!isPending && !data}
        onReload={() => void refetch()}
      />
    </>
  );
}

'use client';

import { POST_RELATION_IDS_MAX, TAG_NAME_MIN_LENGTH } from '@football-portal/validation';
import type { TagFormValues } from '@football-portal/validation/forms';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useController, type Control } from 'react-hook-form';
import { EntityPicker } from '@/components/entity-picker/EntityPicker';
import { newTagFormValues } from '@/components/tags/tagForm';
import { TAG_WARNING_NOTE_CLASS } from '@/components/tags/tagNoteStyles';
import { useAdminTags } from '@/hooks/useAdminTags';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { AdminTag, AdminTagRef } from '@/lib/api/types';
import {
  findTagByName,
  postCountLabel,
  searchTags,
  sortTagsByTitle,
  tagNameIn,
  tagTitle,
} from '@/lib/tagNames';
import { NEW_TAG_NAME_FIELD_IDS, NewTagDialog } from './NewTagDialog';
import type { PostFormValues } from './postFormSchema';
import { isRelationLimitReached, withoutRelationId, withRelationId } from './postRelations';

/** На новину — 3–5 тегів (D51, `editor-guide.md`): більше — м'яка підказка, не помилка. */
const RECOMMENDED_TAGS_MAX = 5;
const LINK_BUTTON_CLASS = 'text-green-400 underline-offset-2 transition-colors hover:text-green-300 hover:underline';

interface PostTagsFieldProps {
  control: Control<PostFormValues>;
  /** Теги збереженої новини: назви чипів, поки список тегів не завантажився */
  savedTags: readonly AdminTagRef[];
}

/**
 * Теги новини (D51): пошук серед усіх тегів на клієнті (їх сотні — не чекбокси), чипи вибраних за назвою, новий тег —
 * у міні-формі просто звідси.
 */
export function PostTagsField({ control, savedTags }: PostTagsFieldProps) {
  const { field } = useController({ control, name: 'tagIds' });
  const { data: tags, isPending, isError, refetch } = useAdminTags();
  const [query, setQuery] = useState('');
  // Вибрані й створені тут: чип не губить назви, навіть якщо список перечитався без них (тег щойно видалили)
  const [pickedTags, setPickedTags] = useState<ReadonlyMap<string, AdminTagRef>>(() => new Map());
  const newTagDialog = useModalDialog<TagFormValues>();
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIds = field.value;
  const tagById = (id: string) =>
    tags?.find((tag) => tag.id === id) ?? pickedTags.get(id) ?? savedTags.find((tag) => tag.id === id);
  const selectedTags = sortTagsByTitle(selectedIds.flatMap((id) => tagById(id) ?? []));
  const trimmedQuery = query.trim();
  const found = tags && trimmedQuery ? searchTags(tags, trimmedQuery) : null;
  // Тег з такою назвою вже є — його й вибирають; «створити» — лише нову тему
  const canCreate = Boolean(tags) && trimmedQuery.length >= TAG_NAME_MIN_LENGTH && !findTagByName(tags ?? [], trimmedQuery);
  const isFull = isRelationLimitReached(selectedIds);

  const pickTag = (tag: AdminTagRef) => {
    field.onChange(withRelationId(field.value, tag.id));
    setPickedTags((picked) => new Map(picked).set(tag.id, tag));
  };
  const openNewTagForm = () => {
    const initialValues = newTagFormValues(trimmedQuery);
    newTagDialog.open(initialValues);
    // `showModal` ставить фокус на першу назву; введене вже в англійській — далі українська
    if (initialValues.nameEn) document.getElementById(NEW_TAG_NAME_FIELD_IDS.nameUk)?.focus();
  };
  const addTagFromDialog = (tag: AdminTag) => {
    pickTag(tag);
    newTagDialog.close();
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-800 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">Tags</legend>
      <EntityPicker
        idPrefix="post-tags"
        label="Find a tag"
        chipsLabel="Tags of the post"
        chips={selectedTags.map((tag) => ({ id: tag.id, label: tagTitle(tag), name: tagTitle(tag) }))}
        onRemove={(id) => field.onChange(withoutRelationId(field.value, id))}
        query={query}
        onQueryChange={setQuery}
        placeholder="Name in English or Ukrainian, or address"
        hint="3–5 topics of the post, such as “Transfers” or “Injuries”: pick existing tags first. Clubs and competitions have their own fields below."
        options={found?.tags ?? null}
        getOptionId={(tag) => tag.id}
        renderOption={renderTagOption}
        isOptionSelected={(tag) => selectedIds.includes(tag.id)}
        onPick={pickTag}
        action={canCreate ? { label: <>+ Create tag “{trimmedQuery}”…</>, onSelect: openNewTagForm } : undefined}
        status={tagSearchStatus({ isPending, hasFailed: isError && !tags, query: trimmedQuery, found, canCreate })}
        limitNote={isFull ? `${POST_RELATION_IDS_MAX} tags is the maximum — remove one to add another.` : undefined}
        inputRef={inputRef}
      />
      {isError && !tags && (
        <button type="button" onClick={() => void refetch()} className={`text-sm ${LINK_BUTTON_CLASS}`}>
          Try loading tags again
        </button>
      )}
      {selectedIds.length > RECOMMENDED_TAGS_MAX && (
        <p className={TAG_WARNING_NOTE_CLASS}>
          {selectedIds.length} tags: 3–5 is recommended — keep the main topics of the post.
        </p>
      )}
      {/* Діалог — через портал поза формою новини: власна <form> усередині неї була б вкладеною формою */}
      {newTagDialog.item &&
        createPortal(
          <NewTagDialog
            dialogRef={newTagDialog.dialogRef}
            openingKey={newTagDialog.openingKey}
            initialValues={newTagDialog.item}
            tags={tags ?? []}
            onClose={newTagDialog.handleClose}
            onCancel={newTagDialog.close}
            onCreated={addTagFromDialog}
            onUseTag={addTagFromDialog}
          />,
          document.body,
        )}
    </fieldset>
  );
}

function renderTagOption(tag: AdminTag) {
  const nameUk = tagNameIn(tag, 'uk');
  return (
    <>
      {tagTitle(tag)}
      {nameUk && (
        <span lang="uk" className="text-gray-400">
          {' '}
          / {nameUk}
        </span>
      )}
      <span className="ml-2 text-xs text-gray-500">{postCountLabel(tag.postCount)}</span>
    </>
  );
}

interface TagSearchState {
  isPending: boolean;
  hasFailed: boolean;
  query: string;
  found: { tags: readonly AdminTag[]; total: number } | null;
  canCreate: boolean;
}

/** Що сказати про пошук тегів — видимо й екранному диктору. */
function tagSearchStatus({ isPending, hasFailed, query, found, canCreate }: TagSearchState): string {
  if (isPending) return 'Loading tags…';
  if (hasFailed) return 'Couldn’t load the tags — check the connection.';
  if (!query || !found) return '';
  if (found.total === 0) {
    return canCreate ? `No tags match — press Enter to create “${query}”.` : 'No tags match.';
  }
  if (found.total > found.tags.length) {
    return `Showing ${found.tags.length} of ${found.total} tags — refine your search.`;
  }
  return found.total === 1 ? '1 tag found.' : `${found.total} tags found.`;
}

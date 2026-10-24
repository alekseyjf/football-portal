'use client';

import { useMemo, useRef, useState } from 'react';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { AdminTag } from '@/lib/api/types';
import { filterTags, postCountLabel, sortTagsForList, tagTitle, type TagListOrder } from '@/lib/tagNames';
import { DeleteTagDialog } from './DeleteTagDialog';
import { RenameTagDialog } from './RenameTagDialog';
import { TagListRow } from './TagListRow';

const HEADING_ID = 'tag-list-heading';
const FILTER_INPUT_ID = 'tag-filter';
const ORDER_SELECT_ID = 'tag-order';
const LINK_CLASS = 'text-green-400 transition-colors hover:text-green-300';
const TOOLBAR_CONTROL_CLASS =
  'rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-green-500';

/** Варіанти порядку — у тому порядку, як їх показує список. */
const TAG_LIST_ORDER_LABELS: Record<TagListOrder, string> = {
  name: 'Name (A–Z)',
  'posts-desc': 'Most posts first',
  'posts-asc': 'Fewest posts first',
};

function isTagListOrder(value: string): value is TagListOrder {
  return value in TAG_LIST_ORDER_LABELS;
}

interface TagListSectionProps {
  /** Усі теги — за назвою */
  tags: readonly AdminTag[];
  isPending: boolean;
  /** Список не завантажився, і показати нічого */
  hasFailed: boolean;
  /** Перечитати список: «Спробувати ще» і справжня кількість новин перед видаленням */
  onReload: () => void;
}

function tagCountText(visibleCount: number, totalCount: number, isFiltered: boolean): string {
  const tagsWord = (count: number) => (count === 1 ? 'tag' : 'tags');
  return isFiltered ? `${visibleCount} of ${totalCount} ${tagsWord(totalCount)}` : `${totalCount} ${tagsWord(totalCount)}`;
}

/**
 * Усі теги (D45): фільтр за назвою будь-якою мовою чи адресою й порядок (за назвою чи кількістю новин) — на клієнті
 * (API віддає всі одним списком); перейменування й видалення — у діалогах, по одному на список.
 */
export function TagListSection({ tags, isPending, hasFailed, onReload }: TagListSectionProps) {
  const [filter, setFilter] = useState('');
  const [order, setOrder] = useState<TagListOrder>('name');
  const [notice, setNotice] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const renameDialog = useModalDialog<AdminTag>();
  const deleteDialog = useModalDialog<AdminTag>();
  const visibleTags = useMemo(() => sortTagsForList(filterTags(tags, filter), order), [tags, filter, order]);
  const deletingTagId = deleteDialog.item?.id;
  // Кількість новин — з останнього списку: його перечитуємо, щойно діалог відкрито
  const deletingTag = tags.find((tag) => tag.id === deletingTagId) ?? deleteDialog.item;

  const openDelete = (tag: AdminTag) => {
    onReload();
    deleteDialog.open(tag);
  };
  const handleRenamed = (tag: AdminTag) => {
    renameDialog.close();
    setNotice(`Tag “${tagTitle(tag)}” renamed.`);
  };
  const handleDeleted = (tag: AdminTag) => {
    deleteDialog.close();
    setNotice(
      tag.postCount > 0
        ? `Tag “${tagTitle(tag)}” deleted and removed from ${postCountLabel(tag.postCount)}.`
        : `Tag “${tagTitle(tag)}” deleted.`,
    );
    // Рядка, з якого відкрили діалог, уже немає — фокус на заголовок списку, а не на початок сторінки
    headingRef.current?.focus();
  };
  const clearFilter = () => {
    setFilter('');
    filterInputRef.current?.focus();
  };

  return (
    <section aria-labelledby={HEADING_ID}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={HEADING_ID} ref={headingRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
          All tags
        </h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label htmlFor={FILTER_INPUT_ID} className="sr-only">
            Filter tags by name or address
          </label>
          <input
            ref={filterInputRef}
            id={FILTER_INPUT_ID}
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by name or address…"
            autoComplete="off"
            className={`w-full placeholder-gray-500 sm:w-64 ${TOOLBAR_CONTROL_CLASS}`}
          />
          {/* Кількість новин — за спаданням чи зростанням: «Fewest posts first» знаходить теги без новин */}
          <label htmlFor={ORDER_SELECT_ID} className="sr-only">
            Sort tags
          </label>
          <select
            id={ORDER_SELECT_ID}
            value={order}
            onChange={(event) => {
              if (isTagListOrder(event.target.value)) setOrder(event.target.value);
            }}
            className={TOOLBAR_CONTROL_CLASS}
          >
            {Object.entries(TAG_LIST_ORDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Області оголошень — у DOM завжди */}
      <p role="status" className="text-sm text-gray-400">
        {!isPending && tags.length > 0 && tagCountText(visibleTags.length, tags.length, Boolean(filter.trim()))}
      </p>
      <p role="status" className="mb-3 text-sm text-green-400">
        {notice}
      </p>

      {isPending ? (
        <p className="py-12 text-center text-gray-400">Loading tags…</p>
      ) : hasFailed ? (
        <div className="py-12 text-center">
          <p className="text-red-400">Failed to load tags. Check that you are logged in as admin.</p>
          <button type="button" onClick={onReload} className={`mt-3 text-sm ${LINK_CLASS}`}>
            Try again
          </button>
        </div>
      ) : tags.length === 0 ? (
        <p className="py-12 text-center text-gray-400">No tags yet — create the first one above.</p>
      ) : visibleTags.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p>No tags match “{filter.trim()}”.</p>
          <button type="button" onClick={clearFilter} className={`mt-2 ${LINK_CLASS}`}>
            Show all tags
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleTags.map((tag) => (
            <TagListRow key={tag.id} tag={tag} onRename={renameDialog.open} onDelete={openDelete} />
          ))}
        </ul>
      )}

      <RenameTagDialog
        dialogRef={renameDialog.dialogRef}
        tag={renameDialog.item}
        openingKey={renameDialog.openingKey}
        onClose={renameDialog.handleClose}
        onCancel={renameDialog.close}
        onRenamed={handleRenamed}
      />
      <DeleteTagDialog
        dialogRef={deleteDialog.dialogRef}
        tag={deletingTag}
        openingKey={deleteDialog.openingKey}
        onClose={deleteDialog.handleClose}
        onCancel={deleteDialog.close}
        onDeleted={handleDeleted}
      />
    </section>
  );
}

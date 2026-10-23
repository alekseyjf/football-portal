'use client';

import { publicTagPath } from '@football-portal/validation';
import { tagNamesFormSchema, type TagNamesFormValues } from '@football-portal/validation/forms';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, type RefObject } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FootballNameWarning } from '@/components/tags/FootballNameWarning';
import { TagNameFields } from '@/components/tags/TagNameFields';
import { tagFormServerErrorMessage, toTagNamesFormValues, toUpdateTagRequest } from '@/components/tags/tagForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useUpdateTag } from '@/hooks/useUpdateTag';
import type { AdminTag } from '@/lib/api/types';
import { DIALOG_BUTTON_CLASS, DIALOG_CLASS } from './dialogStyles';

const DIALOG_TITLE_ID = 'rename-tag-dialog-title';
const SUBMIT_LABEL = 'Save names';

interface RenameTagDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** Тег, який перейменовують, — знімок на мить відкриття; `null` — діалог закрито */
  tag: AdminTag | null;
  onClose: () => void;
  onCancel: () => void;
  onRenamed: (tag: AdminTag) => void;
}

/** Перейменування тегу в нативному `<dialog>`: змінюються назви, адреса — ні (D45). */
export function RenameTagDialog({ dialogRef, tag, onClose, onCancel, onRenamed }: RenameTagDialogProps) {
  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby={DIALOG_TITLE_ID} className={DIALOG_CLASS}>
      {/* `key` — кожне відкриття починає з назв саме цього тегу */}
      {tag && <RenameTagForm key={tag.id} tag={tag} onCancel={onCancel} onRenamed={onRenamed} />}
    </dialog>
  );
}

interface RenameTagFormProps {
  tag: AdminTag;
  onCancel: () => void;
  onRenamed: (tag: AdminTag) => void;
}

function RenameTagForm({ tag, onCancel, onRenamed }: RenameTagFormProps) {
  const savedNames = useMemo(() => toTagNamesFormValues(tag), [tag]);
  const { mutateAsync: updateTag } = useUpdateTag(tag.id);
  // Обидві назви обов'язкові (D51): прибрати збережену не можна, а тег без української (в обхід API) її отримає
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TagNamesFormValues>({ resolver: zodResolver(tagNamesFormSchema), defaultValues: savedNames });
  useUnsavedChangesGuard(isDirty);
  const nameEn = useWatch({ control, name: 'nameEn' });

  const submit = handleSubmit(async (values) => {
    // Змінились лише пробіли по краях — зберігати нічого
    const body = toUpdateTagRequest(savedNames, values);
    if (!body) {
      onCancel();
      return;
    }
    try {
      onRenamed(await updateTag(body));
    } catch (error) {
      setError('root.server', { type: 'server', message: tagFormServerErrorMessage(error, SUBMIT_LABEL) });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h2 id={DIALOG_TITLE_ID} className="text-lg font-semibold">
        Rename tag
      </h2>
      <p className="text-sm text-gray-400">
        The address stays <code className="break-all text-gray-300">{publicTagPath('en', tag.slug)}</code>: renaming
        changes only the names — on the site and in every post with this tag.
      </p>
      <TagNameFields
        idPrefix="rename-tag"
        nameEn={register('nameEn')}
        nameUk={register('nameUk')}
        errors={{ nameEn: errors.nameEn?.message, nameUk: errors.nameUk?.message }}
        ukHint={savedNames.nameUk ? undefined : 'This tag has no Ukrainian name yet — add it: both names are required.'}
        enNote={<FootballNameWarning nameEn={nameEn} />}
      />
      {errors.root?.server && (
        <p role="alert" className="text-sm text-red-400">
          {errors.root.server.message}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={`bg-gray-800 hover:bg-gray-700 ${DIALOG_BUTTON_CLASS}`}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className={`bg-green-600 font-semibold hover:bg-green-500 ${DIALOG_BUTTON_CLASS}`}
        >
          {isSubmitting ? 'Saving…' : SUBMIT_LABEL}
        </button>
      </div>
    </form>
  );
}

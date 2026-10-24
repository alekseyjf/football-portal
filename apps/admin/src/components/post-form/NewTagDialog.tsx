'use client';

import { slugifyTagName } from '@football-portal/validation';
import { tagFormSchema, type TagFormValues } from '@football-portal/validation/forms';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FormEvent, RefObject } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { DIALOG_BUTTON_CLASS, DIALOG_CLASS } from '@/components/dialogStyles';
import { FootballNameWarning } from '@/components/tags/FootballNameWarning';
import { SimilarTagsNote } from '@/components/tags/SimilarTagsNote';
import { TagAddressNote } from '@/components/tags/TagAddressNote';
import { TagNameFields, tagNameFieldIds } from '@/components/tags/TagNameFields';
import { TagSlugField } from '@/components/tags/TagSlugField';
import { tagFormServerErrorMessage, toCreateTagRequest } from '@/components/tags/tagForm';
import { TAG_WARNING_NOTE_CLASS } from '@/components/tags/tagNoteStyles';
import { useCreateTag } from '@/hooks/useCreateTag';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { isApiError } from '@/lib/api/http';
import type { AdminTag } from '@/lib/api/types';
import { tagTitle } from '@/lib/tagNames';

const FORM_ID = 'post-new-tag';
const TITLE_ID = `${FORM_ID}-title`;
const SUBMIT_LABEL = 'Create tag';
/** id полів назв: фокус — на ту, яку ще треба вписати */
export const NEW_TAG_NAME_FIELD_IDS = tagNameFieldIds(FORM_ID);

interface NewTagDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** `key` форми — свій для кожного відкриття (`useModalDialog`): вона щоразу починає з `initialValues` */
  openingKey: number;
  /** Поля на мить відкриття — введене в пошук (`newTagFormValues`) */
  initialValues: TagFormValues;
  /** Усі теги: схожі наявні й зайнята адреса — ще до запиту */
  tags: readonly AdminTag[];
  onClose: () => void;
  onCancel: () => void;
  onCreated: (tag: AdminTag) => void;
  /** Замість нового — наявний тег: схожий чи з тією самою адресою */
  onUseTag: (tag: AdminTag) => void;
}

/**
 * Новий тег просто з форми новини (D51) — у нативному `<dialog>`: назви EN і UK, прев'ю адреси, схожі наявні теги,
 * попередження про клуб чи турнір. Рендерить його той, хто відкриває, — через портал: власна `<form>` усередині форми
 * новини була б вкладеною формою, якої HTML не дозволяє.
 */
export function NewTagDialog({ dialogRef, openingKey, onClose, ...formProps }: NewTagDialogProps) {
  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby={TITLE_ID} className={DIALOG_CLASS}>
      <NewTagForm key={openingKey} {...formProps} />
    </dialog>
  );
}

type NewTagFormProps = Omit<NewTagDialogProps, 'dialogRef' | 'openingKey' | 'onClose'>;

function NewTagForm({ initialValues, tags, onCancel, onCreated, onUseTag }: NewTagFormProps) {
  const { mutateAsync: createTag } = useCreateTag();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TagFormValues>({ resolver: zodResolver(tagFormSchema), defaultValues: initialValues });
  useUnsavedChangesGuard(isDirty);

  const [nameEn, nameUk, slug] = useWatch({ control, name: ['nameEn', 'nameUk', 'slug'] });
  const suggestedSlug = slugifyTagName(nameEn);
  const addressSlug = slug.trim() || suggestedSlug;
  const takenBy = addressSlug ? tags.find((tag) => tag.slug === addressSlug) : undefined;
  // Адресу вписують, лише коли з англійської назви її не зробити — без латиниці (як і на сторінці тегів)
  const showsSlugField = Boolean(slug) || (nameEn.trim() !== '' && suggestedSlug === null);

  const submit = handleSubmit(async (values) => {
    try {
      onCreated(await createTag(toCreateTagRequest(values)));
    } catch (error) {
      setError('root.server', { type: 'server', message: newTagErrorMessage(error, showsSlugField) });
    }
  });
  // Діалог — у порталі, поза формою новини в DOM, але подія submit спливає деревом компонентів React до форми
  // новини: далі її не пускаємо — інакше створення тегу відправило б і новину
  const submitOwnForm = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submit(event);
  };

  return (
    <form onSubmit={submitOwnForm} noValidate className="space-y-4">
      <h2 id={TITLE_ID} className="text-lg font-semibold">
        New tag
      </h2>
      <p className="text-sm text-gray-400">
        A topic such as “Transfers”, not a club or competition — they have their own fields. The tag is created right
        away and added to this post; it stays in the tags list even if the post isn’t saved.
      </p>
      <TagNameFields
        idPrefix={FORM_ID}
        // Адреса залежить від англійської назви: після невдалої відправки її помилка оновлюється разом з назвою
        nameEn={register('nameEn', { deps: ['slug'] })}
        nameUk={register('nameUk')}
        errors={{ nameEn: errors.nameEn?.message, nameUk: errors.nameUk?.message }}
        enNote={<FootballNameWarning nameEn={nameEn} />}
      />
      <SimilarTagsNote tags={tags} nameEn={nameEn} nameUk={nameUk} onUseTag={onUseTag} />
      {showsSlugField ? (
        <TagSlugField
          fieldId={`${FORM_ID}-slug`}
          registration={register('slug')}
          error={errors.slug?.message}
          addressSlug={addressSlug}
          suggestedSlug={suggestedSlug}
        />
      ) : (
        <p className="text-xs text-gray-500">
          <TagAddressNote slug={addressSlug} />
        </p>
      )}
      {/* Область оголошень — у DOM завжди: після 409 перечитаний список назве наявний тег саме тут */}
      <div role="status">
        {takenBy && (
          <div className={TAG_WARNING_NOTE_CLASS}>
            <p>The tag “{tagTitle(takenBy)}” already has this address.</p>
            <button
              type="button"
              onClick={() => onUseTag(takenBy)}
              className="mt-2 rounded-lg border border-amber-400/60 px-3 py-1 text-amber-200 transition-colors hover:bg-amber-500/10"
            >
              Use “{tagTitle(takenBy)}”
            </button>
          </div>
        )}
      </div>
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
          disabled={isSubmitting}
          className={`bg-green-600 font-semibold hover:bg-green-500 ${DIALOG_BUTTON_CLASS}`}
        >
          {isSubmitting ? 'Creating…' : SUBMIT_LABEL}
        </button>
      </div>
    </form>
  );
}

/**
 * Помилка `POST /tags` у формі новини. 409 — тег з цією адресою вже є (його щойно створили в іншій вкладці): список
 * перечитується (`useCreateTag`), і наявний з'являється вище з кнопкою «вибрати»; поля адреси може й не бути — тоді
 * адреса йде з англійської назви.
 */
function newTagErrorMessage(error: unknown, showsSlugField: boolean): string {
  if (isApiError(error) && error.code === 'TAG_SLUG_TAKEN') {
    const change = showsSlugField ? 'type another address' : 'change the English name — the address is made from it';
    return `This tag already exists — use it, or ${change}.`;
  }
  return tagFormServerErrorMessage(error, SUBMIT_LABEL);
}

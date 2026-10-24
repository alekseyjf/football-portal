'use client';

import { publicTagPath, slugifyTagName } from '@football-portal/validation';
import { tagFormSchema, type TagFormValues } from '@football-portal/validation/forms';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FootballNameWarning } from '@/components/tags/FootballNameWarning';
import { SimilarTagsNote } from '@/components/tags/SimilarTagsNote';
import { TagNameFields } from '@/components/tags/TagNameFields';
import { TagSlugField } from '@/components/tags/TagSlugField';
import {
  EMPTY_TAG_FORM_VALUES,
  isTagSlugError,
  tagFormServerErrorMessage,
  toCreateTagRequest,
} from '@/components/tags/tagForm';
import { useCreateTag } from '@/hooks/useCreateTag';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { AdminTag } from '@/lib/api/types';
import { tagTitle } from '@/lib/tagNames';

const FORM_ID = 'new-tag';
const SUBMIT_LABEL = 'Create tag';

/**
 * Новий тег (D45, D51): назви EN і UK — обидві обов'язкові, адреса — з англійської назви або вписана. Поки вводять
 * назву, форма показує схожі наявні теги й клуб чи турнір з такою самою назвою; після створення — порожня, для
 * наступного тегу.
 */
export function CreateTagForm({ tags }: { tags: readonly AdminTag[] }) {
  const { mutateAsync: createTag } = useCreateTag();
  const [createdTag, setCreatedTag] = useState<AdminTag | null>(null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TagFormValues>({ resolver: zodResolver(tagFormSchema), defaultValues: EMPTY_TAG_FORM_VALUES });
  useUnsavedChangesGuard(isDirty);

  const [nameEn, nameUk, slug] = useWatch({ control, name: ['nameEn', 'nameUk', 'slug'] });
  const suggestedSlug = slugifyTagName(nameEn);
  const addressSlug = slug.trim() || suggestedSlug;
  const takenBy = addressSlug ? tags.find((tag) => tag.slug === addressSlug) : undefined;

  const submit = handleSubmit(async (values) => {
    try {
      setCreatedTag(await createTag(toCreateTagRequest(values)));
      // Фокус — до `reset`: після нього React Hook Form перереєстровує поля, і до наступного рендеру `setFocus` їх
      // не знаходить (фокус лишився б на `body` — кнопка, вимкнена на час запиту, його втратила)
      setFocus('nameEn');
      reset(EMPTY_TAG_FORM_VALUES);
    } catch (error) {
      // Адреса зайнята чи її не вийшло зробити з назви — помилка й фокус біля поля адреси, решта — над кнопкою
      const isSlugError = isTagSlugError(error);
      setError(
        isSlugError ? 'slug' : 'root.server',
        { type: 'server', message: tagFormServerErrorMessage(error, SUBMIT_LABEL) },
        { shouldFocus: isSlugError },
      );
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TagNameFields
        idPrefix={FORM_ID}
        // Адреса залежить від англійської назви: після невдалої відправки її помилка має оновитись разом з назвою
        nameEn={register('nameEn', { deps: ['slug'] })}
        nameUk={register('nameUk')}
        errors={{ nameEn: errors.nameEn?.message, nameUk: errors.nameUk?.message }}
        enNote={<FootballNameWarning nameEn={nameEn} />}
      />
      <SimilarTagsNote tags={tags} nameEn={nameEn} nameUk={nameUk} />
      <TagSlugField
        fieldId={`${FORM_ID}-slug`}
        registration={register('slug')}
        error={errors.slug?.message}
        addressSlug={addressSlug}
        suggestedSlug={suggestedSlug}
        takenBy={takenBy}
      />

      {errors.root?.server && (
        <p role="alert" className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errors.root.server.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-green-600 px-6 py-3 font-semibold transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-800"
        >
          {isSubmitting ? 'Creating…' : SUBMIT_LABEL}
        </button>
        {/* Область оголошень — у DOM завжди; повідомлення — доки не почали новий тег */}
        <p role="status" className="text-sm text-green-400">
          {createdTag && !isDirty && (
            <>
              <span aria-hidden="true">✓ </span>Tag “{tagTitle(createdTag)}” created:{' '}
              <code className="break-all">{publicTagPath('en', createdTag.slug)}</code>
            </>
          )}
        </p>
      </div>
    </form>
  );
}

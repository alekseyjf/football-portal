'use client';

import { useState, type ChangeEvent } from 'react';
import {
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { mediaUrlSchema } from '@football-portal/validation/forms';
import { FormField, OptionalMark } from './FormField';
import { controlProps } from './formStyles';
import {
  COVER_IMAGE_TEXT_FIELD_NAMES,
  DEPENDENT_FIELD_NAMES,
  hasCoverImage,
  type PostFormValues,
} from './postFormSchema';

interface CoverImageFieldsProps {
  register: UseFormRegister<PostFormValues>;
  control: Control<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
  setValue: UseFormSetValue<PostFormValues>;
}

/** Обкладинка (D44): адреса фото, прев'ю, опис для незрячих кожною мовою, підпис автора фото. */
export function CoverImageFields({ register, control, errors, setValue }: CoverImageFieldsProps) {
  const coverImageUrl = useWatch({ control, name: 'coverImageUrl' });
  const previewUrl = mediaUrlSchema.safeParse(coverImageUrl).success ? coverImageUrl.trim() : null;

  // Інша адреса — інше фото (D44): опис і підпис попереднього до нього не переносимо. `coverImageUrl` тут —
  // значення до цієї зміни (з останнього рендеру)
  const clearTextOfPreviousImage = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value.trim() === coverImageUrl.trim()) return;
    for (const fieldName of COVER_IMAGE_TEXT_FIELD_NAMES) {
      setValue(fieldName, '', { shouldDirty: true });
    }
  };

  return (
    <fieldset className="space-y-4 rounded-xl border border-gray-800 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">
        Cover image <OptionalMark />
      </legend>
      <FormField fieldId="coverImageUrl" label="Image URL" error={errors.coverImageUrl?.message}>
        <input
          {...register('coverImageUrl', {
            deps: DEPENDENT_FIELD_NAMES.coverImageUrl,
            onChange: clearTextOfPreviousImage,
          })}
          {...controlProps('coverImageUrl', !!errors.coverImageUrl)}
          placeholder="https://images.unsplash.com/…"
        />
      </FormField>

      {hasCoverImage(coverImageUrl) && (
        <>
          <p className="text-xs text-gray-500">
            To publish: describe the photo in every language of the post and credit its author. A new image URL
            clears both — they belong to the previous photo.
          </p>
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {previewUrl ? <CoverImagePreview url={previewUrl} /> : <div aria-hidden="true" />}
            <CoverImageTextFields register={register} errors={errors} />
          </div>
        </>
      )}
    </fieldset>
  );
}

/** Фото так, як його завантажить сайт: опис пишуть, дивлячись на фото. */
function CoverImagePreview({ url }: { url: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (failedUrl === url) {
    return (
      <p role="status" className="self-start rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
        The photo did not load — check that the URL opens the image itself, not a page with it.
      </p>
    );
  }
  return (
    // Звичайний <img>, як на сайті (D44): фото з будь-якого https-хоста, без оптимізатора next/image
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Cover image preview"
      onError={() => setFailedUrl(url)}
      className="max-h-72 w-full rounded-lg bg-gray-900 object-contain"
    />
  );
}

function CoverImageTextFields({
  register,
  errors,
}: Pick<CoverImageFieldsProps, 'register' | 'errors'>) {
  return (
    <div className="space-y-4">
      <FormField fieldId="coverImageAltEn" label="Alt text — English" error={errors.coverImageAltEn?.message}>
        <input
          {...register('coverImageAltEn')}
          {...controlProps('coverImageAltEn', !!errors.coverImageAltEn)}
          lang="en"
          placeholder="Arsenal players celebrate the winning goal"
        />
      </FormField>
      <FormField
        fieldId="coverImageAltUk"
        label={
          <>
            Alt text — Українська{' '}
            <span className="font-normal text-gray-500">(if the Ukrainian version is filled)</span>
          </>
        }
        error={errors.coverImageAltUk?.message}
      >
        <input
          {...register('coverImageAltUk')}
          {...controlProps('coverImageAltUk', !!errors.coverImageAltUk)}
          lang="uk"
          placeholder="Гравці «Арсенала» святкують переможний гол"
        />
      </FormField>
      <FormField
        fieldId="coverImageCredit"
        label={
          <>
            Credit <span className="font-normal text-gray-500">(the site adds “Photo:”)</span>
          </>
        }
        error={errors.coverImageCredit?.message}
      >
        <input
          {...register('coverImageCredit')}
          {...controlProps('coverImageCredit', !!errors.coverImageCredit)}
          placeholder="Stuart MacFarlane / Getty Images"
        />
      </FormField>
    </div>
  );
}

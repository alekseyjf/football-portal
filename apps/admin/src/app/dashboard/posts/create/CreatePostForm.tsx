"use client";

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isApiError } from '@/lib/api/http';
import { useCreatePost } from '@/hooks/useCreatePost';
import { CoverImageFields } from './CoverImageFields';
import {
  createPostFormSchema,
  DEPENDENT_FIELD_NAMES,
  hasCoverImage,
  hasUkText,
  toCreatePostRequest,
  UK_FIELD_NAMES,
  type CreatePostFormValues,
} from './createPostFormSchema';
import { inputClass } from './formStyles';

const PUBLICATION_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', hint: 'Not visible on the site' },
  { value: 'PUBLISHED', label: 'Publish now', hint: 'Visible immediately' },
  { value: 'SCHEDULED', label: 'Schedule', hint: 'Goes live at the chosen time' },
] as const;

type PublicationChoice = (typeof PUBLICATION_OPTIONS)[number]['value'];

/** Коди помилок `POST /posts` → текст для редактора. */
const SERVER_ERROR_MESSAGES: Record<string, string> = {
  SCHEDULED_AT_IN_PAST: 'Scheduled time is already in the past — pick a later time.',
  PUBLISHED_AT_REQUIRED: 'Choose when the post goes live.',
  PUBLISHED_AT_IN_FUTURE: 'A published post cannot have a future date — use Schedule.',
  DEFAULT_TRANSLATION_REQUIRED: 'The English version is required.',
  UNSUPPORTED_LANGUAGE: 'One of the languages is not enabled.',
  COVER_IMAGE_ALT_REQUIRED: 'Describe the cover photo in every language of the post — required to publish.',
  COVER_IMAGE_CREDIT_REQUIRED: 'Credit the author of the cover photo — required to publish.',
  TOO_MANY_REQUESTS: 'Too many requests — try again in a minute.',
};

function serverErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong';
  if (error.status === 403) return 'Access denied — admin account required.';
  return SERVER_ERROR_MESSAGES[error.code] ?? error.code;
}

/** Поточний момент у форматі `datetime-local` — нижня межа поля. */
function localDateTimeNow(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function CreatePostForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutateAsync: createPost, isPending } = useCreatePost();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreatePostFormValues>({
    resolver: zodResolver(createPostFormSchema),
    defaultValues: {
      titleUk: '',
      excerptUk: '',
      contentUk: '',
      coverImageUrl: '',
      coverImageAltEn: '',
      coverImageAltUk: '',
      coverImageCredit: '',
      publication: 'DRAFT',
      scheduledAt: '',
    },
  });

  const publication: PublicationChoice = useWatch({ control, name: 'publication' });
  const ukFieldValues = useWatch({ control, name: UK_FIELD_NAMES });
  const coverImageUrl = useWatch({ control, name: 'coverImageUrl' });
  // Лише попередження, не блок (D23): без UK новина виходить, а термінова не чекає перекладу
  const isPublishingWithoutUk = publication !== 'DRAFT' && !hasUkText(ukFieldValues);

  const onSubmit = async (data: CreatePostFormValues) => {
    setServerError(null);
    try {
      await createPost(toCreatePostRequest(data));
      router.push('/dashboard/posts');
      router.refresh();
    } catch (err) {
      setServerError(serverErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">{serverError}</p>
        </div>
      )}

      <p className="text-sm text-gray-400">
        Slug генерується з англійського заголовка на API і після створення не змінюється.
      </p>

      <div className="space-y-4 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-green-400">English (required)</h2>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Title</label>
          <input {...register('titleEn')} placeholder="Post title…" className={inputClass(!!errors.titleEn)} />
          {errors.titleEn && <p className="text-red-400 text-xs">{errors.titleEn.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Excerpt</label>
          <textarea {...register('excerptEn')} rows={2} placeholder="Short description…" className={inputClass(!!errors.excerptEn)} />
          {errors.excerptEn && <p className="text-red-400 text-xs">{errors.excerptEn.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Content</label>
          <textarea {...register('contentEn')} rows={10} placeholder="Full post…" className={inputClass(!!errors.contentEn)} />
          {errors.contentEn && <p className="text-red-400 text-xs">{errors.contentEn.message}</p>}
        </div>
      </div>

      <div className="space-y-4 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-400">
          Українська (опційно — без перекладу сайт покаже англійську версію)
        </h2>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Title</label>
          <input {...register('titleUk', { deps: DEPENDENT_FIELD_NAMES.ukTranslation })} className={inputClass(!!errors.titleUk)} />
          {errors.titleUk && <p className="text-red-400 text-xs">{errors.titleUk.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Excerpt</label>
          <textarea {...register('excerptUk', { deps: DEPENDENT_FIELD_NAMES.ukTranslation })} rows={2} className={inputClass(!!errors.excerptUk)} />
          {errors.excerptUk && <p className="text-red-400 text-xs">{errors.excerptUk.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Content</label>
          <textarea {...register('contentUk', { deps: DEPENDENT_FIELD_NAMES.ukTranslation })} rows={6} className={inputClass(!!errors.contentUk)} />
          {errors.contentUk && <p className="text-red-400 text-xs">{errors.contentUk.message}</p>}
        </div>
      </div>

      <CoverImageFields
        register={register}
        errors={errors}
        hasCoverImage={hasCoverImage(coverImageUrl)}
      />

      <fieldset className="space-y-3 border border-gray-800 rounded-xl p-4">
        <legend className="px-1 text-sm font-semibold text-gray-300">Publication</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PUBLICATION_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 transition-colors ${
                publication === option.value
                  ? 'border-green-500 bg-green-600/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  {...register('publication', { deps: DEPENDENT_FIELD_NAMES.publication })}
                  type="radio"
                  value={option.value}
                  className="accent-green-500"
                />
                {option.label}
              </span>
              <span className="mt-0.5 text-xs text-gray-500">{option.hint}</span>
            </label>
          ))}
        </div>

        {publication === 'SCHEDULED' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">
              Goes live at <span className="text-gray-500">(your local time)</span>
            </label>
            <input
              {...register('scheduledAt')}
              type="datetime-local"
              min={localDateTimeNow()}
              className={inputClass(!!errors.scheduledAt)}
            />
            {errors.scheduledAt && (
              <p className="text-red-400 text-xs">{errors.scheduledAt.message}</p>
            )}
          </div>
        )}

        {isPublishingWithoutUk && (
          <p
            role="status"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
          >
            No Ukrainian translation: on /uk/ the post will be shown in English, marked
            “translation unavailable”.
          </p>
        )}
      </fieldset>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {isPending ? 'Creating…' : 'Create Post'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

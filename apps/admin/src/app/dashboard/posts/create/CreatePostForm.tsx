"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  mediaUrlSchema,
  postContentSchema,
  postExcerptSchema,
  postTitleSchema,
} from '@football-portal/validation/forms';
import { isApiError } from '@/lib/api/http';
import type { CreatePostPayload } from '@/lib/api/types';
import { useCreatePost } from '@/hooks/useCreatePost';

const PUBLICATION_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', hint: 'Not visible on the site' },
  { value: 'PUBLISHED', label: 'Publish now', hint: 'Visible immediately' },
  { value: 'SCHEDULED', label: 'Schedule', hint: 'Goes live at the chosen time' },
] as const;

type PublicationChoice = (typeof PUBLICATION_OPTIONS)[number]['value'];

/** Українські поля: або всі порожні, або всі валідні за тими ж межами, що й англійські. */
const UA_FIELD_SCHEMAS = {
  titleUa: postTitleSchema,
  excerptUa: postExcerptSchema,
  contentUa: postContentSchema,
} as const;

const schema = z
  .object({
    // Межі — зі спільного пакета: ті самі числа, що в CreatePostDto API
    titleEn: postTitleSchema,
    excerptEn: postExcerptSchema,
    contentEn: postContentSchema,
    titleUa: z.string(),
    excerptUa: z.string(),
    contentUa: z.string(),
    // Лише https — як `@IsMediaUrl()` у DTO API
    coverImageUrl: mediaUrlSchema.optional().or(z.literal('')),
    publication: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']),
    /** Значення `<input type="datetime-local">` — локальний час редактора */
    scheduledAt: z.string(),
  })
  .superRefine((values, ctx) => {
    const uaFieldNames = Object.keys(UA_FIELD_SCHEMAS) as Array<
      keyof typeof UA_FIELD_SCHEMAS
    >;
    const hasAnyUa = uaFieldNames.some((fieldName) => values[fieldName].trim());
    if (hasAnyUa) {
      for (const fieldName of uaFieldNames) {
        const fieldResult = UA_FIELD_SCHEMAS[fieldName].safeParse(values[fieldName]);
        if (!fieldResult.success) {
          ctx.addIssue({
            code: 'custom',
            path: [fieldName],
            message: values[fieldName].trim()
              ? fieldResult.error.issues[0].message
              : 'Fill all Ukrainian fields or leave all empty',
          });
        }
      }
    }

    if (values.publication === 'SCHEDULED') {
      const scheduledTime = new Date(values.scheduledAt).getTime();
      if (!values.scheduledAt || Number.isNaN(scheduledTime)) {
        ctx.addIssue({
          code: 'custom',
          path: ['scheduledAt'],
          message: 'Choose when the post goes live',
        });
      } else if (scheduledTime <= Date.now()) {
        ctx.addIssue({
          code: 'custom',
          path: ['scheduledAt'],
          message: 'Scheduled time must be in the future',
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

/** Коди помилок `POST /posts` → текст для редактора. */
const SERVER_ERROR_MESSAGES: Record<string, string> = {
  SCHEDULED_AT_IN_PAST: 'Scheduled time is already in the past — pick a later time.',
  PUBLISHED_AT_REQUIRED: 'Choose when the post goes live.',
  PUBLISHED_AT_IN_FUTURE: 'A published post cannot have a future date — use Schedule.',
  DEFAULT_TRANSLATION_REQUIRED: 'The English version is required.',
  UNSUPPORTED_LANGUAGE: 'One of the languages is not enabled.',
  TOO_MANY_REQUESTS: 'Too many requests — try again in a minute.',
};

function serverErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong';
  if (error.status === 403) return 'Access denied — admin account required.';
  return SERVER_ERROR_MESSAGES[error.code] ?? error.code;
}

/** `datetime-local` (без зони) → ISO з `Z`: браузер читає його в локальній зоні редактора. */
function toIsoWithZone(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

/** Поточний момент у форматі `datetime-local` — нижня межа поля. */
function localDateTimeNow(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

const inputClass = (hasError: boolean) =>
  `w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none border transition-colors ${hasError ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`;

export function CreatePostForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutateAsync: createPost, isPending } = useCreatePost();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      titleUa: '',
      excerptUa: '',
      contentUa: '',
      coverImageUrl: '',
      publication: 'DRAFT',
      scheduledAt: '',
    },
  });

  const publication: PublicationChoice = watch('publication');

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    // Значення вже після trim (zod-схеми полів)
    const translations: CreatePostPayload['translations'] = [
      {
        languageCode: 'en',
        title: data.titleEn,
        excerpt: data.excerptEn,
        content: data.contentEn,
      },
    ];
    if (data.titleUa.trim()) {
      translations.push({
        languageCode: 'ua',
        title: data.titleUa.trim(),
        excerpt: data.excerptUa.trim(),
        content: data.contentUa.trim(),
      });
    }

    try {
      await createPost({
        translations,
        status: data.publication,
        ...(data.publication === 'SCHEDULED'
          ? { publishedAt: toIsoWithZone(data.scheduledAt) }
          : {}),
        ...(data.coverImageUrl?.trim()
          ? { coverImageUrl: data.coverImageUrl.trim() }
          : {}),
      });
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
          <input {...register('titleUa')} className={inputClass(!!errors.titleUa)} />
          {errors.titleUa && <p className="text-red-400 text-xs">{errors.titleUa.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Excerpt</label>
          <textarea {...register('excerptUa')} rows={2} className={inputClass(!!errors.excerptUa)} />
          {errors.excerptUa && <p className="text-red-400 text-xs">{errors.excerptUa.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300">Content</label>
          <textarea {...register('contentUa')} rows={6} className={inputClass(!!errors.contentUa)} />
          {errors.contentUa && <p className="text-red-400 text-xs">{errors.contentUa.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">
          Cover image URL <span className="text-gray-500">(optional)</span>
        </label>
        <input {...register('coverImageUrl')} placeholder="https://…" className={inputClass(!!errors.coverImageUrl)} />
        {errors.coverImageUrl && <p className="text-red-400 text-xs">{errors.coverImageUrl.message}</p>}
      </div>

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
                  {...register('publication')}
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

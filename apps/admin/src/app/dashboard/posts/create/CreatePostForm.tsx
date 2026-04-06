"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCreatePost } from '@/hooks/useCreatePost';

const schema = z
  .object({
    titleEn: z.string().min(5, 'Title (EN) at least 5 characters'),
    excerptEn: z.string().min(10, 'Excerpt (EN) at least 10 characters'),
    contentEn: z.string().min(20, 'Content (EN) at least 20 characters'),
    titleUa: z.string().optional(),
    excerptUa: z.string().optional(),
    contentUa: z.string().optional(),
    coverImage: z
      .string()
      .url('Must be a valid URL')
      .optional()
      .or(z.literal('')),
    published: z.boolean(),
  })
  .refine(
    (d) => {
      const a = d.titleUa?.trim();
      const b = d.excerptUa?.trim();
      const c = d.contentUa?.trim();
      const anyUa = !!(a || b || c);
      if (!anyUa) return true;
      return !!(a && b && c);
    },
    {
      message: 'Fill all Ukrainian fields or leave all empty',
      path: ['titleUa'],
    },
  );

type FormData = z.infer<typeof schema>;

const inputClass = (hasError: boolean) =>
  `w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none border transition-colors ${hasError ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`;

export function CreatePostForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutateAsync: createPost, isPending } = useCreatePost();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { published: false, titleUa: '', excerptUa: '', contentUa: '' },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const translations: Array<{
      language: 'en' | 'ua';
      title: string;
      excerpt: string;
      content: string;
    }> = [
      {
        language: 'en',
        title: data.titleEn.trim(),
        excerpt: data.excerptEn.trim(),
        content: data.contentEn.trim(),
      },
    ];
    if (data.titleUa?.trim() && data.excerptUa?.trim() && data.contentUa?.trim()) {
      translations.push({
        language: 'ua',
        title: data.titleUa.trim(),
        excerpt: data.excerptUa.trim(),
        content: data.contentUa.trim(),
      });
    }

    try {
      await createPost({
        translations,
        published: data.published,
        ...(data.coverImage?.trim() ? { coverImage: data.coverImage.trim() } : {}),
      });
      router.push('/dashboard/posts');
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong');
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
        Slug генерується з англійського заголовка на API. Створення постів лише з адмінки (POST /posts).
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
        <h2 className="text-sm font-semibold text-gray-400">Українська (опційно)</h2>
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
        <input {...register('coverImage')} placeholder="https://…" className={inputClass(!!errors.coverImage)} />
        {errors.coverImage && <p className="text-red-400 text-xs">{errors.coverImage.message}</p>}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input {...register('published')} type="checkbox" className="w-4 h-4 accent-green-500" />
        <span className="text-sm text-gray-300">Publish immediately</span>
      </label>

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

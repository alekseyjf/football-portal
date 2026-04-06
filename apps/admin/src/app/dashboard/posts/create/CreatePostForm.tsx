"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters'),
  content: z.string().min(20, 'Content must be at least 20 characters'),
  coverImage: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  published: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const inputClass = (hasError: boolean) =>
  `w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none border transition-colors ${hasError ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`;

export function CreatePostForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { published: false },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await api.post('/posts', data);
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

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Title</label>
        <input {...register('title')} placeholder="Post title..." className={inputClass(!!errors.title)} />
        {errors.title && <p className="text-red-400 text-xs">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Excerpt</label>
        <textarea {...register('excerpt')} rows={2} placeholder="Short description..." className={inputClass(!!errors.excerpt)} />
        {errors.excerpt && <p className="text-red-400 text-xs">{errors.excerpt.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Content</label>
        <textarea {...register('content')} rows={10} placeholder="Write your post..." className={inputClass(!!errors.content)} />
        {errors.content && <p className="text-red-400 text-xs">{errors.content.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Cover Image URL <span className="text-gray-500">(optional)</span></label>
        <input {...register('coverImage')} placeholder="https://..." className={inputClass(!!errors.coverImage)} />
        {errors.coverImage && <p className="text-red-400 text-xs">{errors.coverImage.message}</p>}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input {...register('published')} type="checkbox" className="w-4 h-4 accent-green-500" />
        <span className="text-sm text-gray-300">Publish immediately</span>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {isSubmitting ? 'Creating...' : 'Create Post'}
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
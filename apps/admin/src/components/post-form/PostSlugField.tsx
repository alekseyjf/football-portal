'use client';

import { slugifyTitle } from '@football-portal/validation';
import { postSlugSchema } from '@football-portal/validation/forms';
import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import type { AdminPostDetail } from '@/lib/api/types';
import { FormField, OptionalMark } from './FormField';
import { controlProps } from './formStyles';
import type { PostFormValues } from './postFormSchema';

interface PostSlugFieldProps {
  register: UseFormRegister<PostFormValues>;
  control: Control<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
  /** Збережена новина: її номер — в адресі, а в живої зміна адреси — з попередженням */
  post?: Pick<AdminPostDetail, 'number' | 'slug' | 'isLive' | 'publishedAt'>;
}

function slugHint(post: PostSlugFieldProps['post']): string {
  if (post?.isLive) return 'The post is live: type a new address to change it — it can’t be left empty.';
  if (post?.publishedAt) {
    return 'Empty — made from the English title. The post has a publication date, so a new title no longer changes the address by itself.';
  }
  return 'Empty — made from the English title; once the post is published or scheduled, the title no longer changes it.';
}

/**
 * Адреса новини `/{мова}/news/{slug}-{номер}` (D24). У полі — лише те, що ввів редактор (у збереженої — поточний
 * slug, якщо він не просто з заголовка чернетки); підказка — slug з англійського заголовка тією самою
 * транслітерацією, що в API. Порожнє поле — адреса з англійського заголовка; у живої новини порожнім воно бути не
 * може (D50): адресу, що вже розійшлась, міняють лише явно.
 */
export function PostSlugField({ register, control, errors, post }: PostSlugFieldProps) {
  const [titleEn, slug] = useWatch({ control, name: ['titleEn', 'slug'] });
  const suggestedSlug = titleEn.trim() ? slugifyTitle(titleEn) : '';
  const typedSlug = slug.trim();
  const isLive = Boolean(post?.isLive);
  // Порожнє поле живої новини не збережеться — адреса лишиться поточною
  const addressSlug = typedSlug || (isLive && post ? post.slug : suggestedSlug);
  const error = errors.slug?.message;
  // Стара адреса живої новини вже могла розійтись: сайт перенаправить її (308), але зміна не безкоштовна
  const isLiveAddressChange =
    isLive && Boolean(typedSlug) && typedSlug !== post?.slug && postSlugSchema.safeParse(typedSlug).success;

  return (
    <FormField
      fieldId="slug"
      label={
        <>
          Address (slug) {!isLive && <OptionalMark />}
        </>
      }
      error={error}
      hint={
        <>
          On the site:{' '}
          <code className="break-all text-gray-300">
            /en/news/{addressSlug || '…'}-{post ? post.number : '{number}'}
          </code>{' '}
          {post
            ? '(the same with /uk/).'
            : '(the same with /uk/; the number is assigned when the post is saved).'}{' '}
          {slugHint(post)}
        </>
      }
    >
      <input
        {...register('slug')}
        {...controlProps('slug', !!error)}
        placeholder={isLive && post ? post.slug : suggestedSlug || 'made from the English title'}
        autoComplete="off"
        spellCheck={false}
      />
      {isLiveAddressChange && post && (
        <p
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          The post is live: its current address{' '}
          <code className="break-all">
            /en/news/{post.slug}-{post.number}
          </code>{' '}
          will redirect (308) to the new one. Links already shared keep working.
        </p>
      )}
    </FormField>
  );
}

'use client';

import { slugifyTitle } from '@football-portal/validation';
import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { FormField, OptionalMark } from './FormField';
import { controlProps } from './formStyles';
import type { PostFormValues } from './postFormSchema';

interface PostSlugFieldProps {
  register: UseFormRegister<PostFormValues>;
  control: Control<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
}

/**
 * Адреса новини `/{мова}/news/{slug}-{номер}` (D24). У полі — лише те, що ввів редактор; підказка — slug з
 * англійського заголовка тією самою транслітерацією, що в API. Порожнє поле не надсилаємо: явний slug
 * фіксується з публікацією, а з заголовка API збудує той самий, що в підказці.
 */
export function PostSlugField({ register, control, errors }: PostSlugFieldProps) {
  const [titleEn, slug] = useWatch({ control, name: ['titleEn', 'slug'] });
  const suggestedSlug = titleEn.trim() ? slugifyTitle(titleEn) : '';
  const addressSlug = slug.trim() || suggestedSlug || '…';
  const error = errors.slug?.message;

  return (
    <FormField
      fieldId="slug"
      label={
        <>
          Address (slug) <OptionalMark />
        </>
      }
      error={error}
      hint={
        <>
          On the site:{' '}
          <code className="break-all text-gray-300">
            /en/news/{addressSlug}-{'{number}'}
          </code>{' '}
          (the same with /uk/; the number is assigned when the post is saved). Empty — made from the English
          title; once the post is published or scheduled, the title no longer changes it.
        </>
      }
    >
      <input
        {...register('slug')}
        {...controlProps('slug', !!error)}
        placeholder={suggestedSlug || 'made from the English title'}
        autoComplete="off"
        spellCheck={false}
      />
    </FormField>
  );
}

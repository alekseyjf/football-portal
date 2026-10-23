import type { UseFormRegisterReturn } from 'react-hook-form';
import { FormField, OptionalMark } from '@/components/post-form/FormField';
import { controlProps } from '@/components/post-form/formStyles';
import { TagAddressNote } from '@/components/tags/TagAddressNote';
import { TAG_WARNING_NOTE_CLASS } from '@/components/tags/tagNoteStyles';
import type { AdminTag } from '@/lib/api/types';
import { tagTitle } from '@/lib/tagNames';

interface TagSlugFieldProps {
  fieldId: string;
  registration: UseFormRegisterReturn<'slug'>;
  error?: string;
  /** Адреса, яку отримає тег: вписана або з англійської назви; `null` — назви ще немає чи в ній немає латиниці */
  addressSlug: string | null;
  /** Адреса з англійської назви — підказка в порожньому полі */
  suggestedSlug: string | null;
  /** Тег, у якого вже є ця адреса: API відповість 409 `TAG_SLUG_TAKEN` */
  takenBy?: AdminTag;
}

/**
 * Адреса нового тегу (D45): порожнє поле — з англійської назви тією самою транслітерацією, що в API
 * (`slugifyTagName`); вписана — для коротшої адреси чи назви без латиниці. Після створення не змінюється.
 */
export function TagSlugField({ fieldId, registration, error, addressSlug, suggestedSlug, takenBy }: TagSlugFieldProps) {
  return (
    <FormField
      fieldId={fieldId}
      label={
        <>
          Address (slug) <OptionalMark />
        </>
      }
      error={error}
      hint={
        <>
          <TagAddressNote slug={addressSlug} /> Empty — made from the English name.
        </>
      }
    >
      <input
        {...registration}
        {...controlProps(fieldId, Boolean(error))}
        placeholder={suggestedSlug ?? 'made from the English name'}
        autoComplete="off"
        spellCheck={false}
      />
      <div role="status">
        {/* Після 409 — помилка поля: попередження повторювало б її */}
        {takenBy && !error && (
          <p className={TAG_WARNING_NOTE_CLASS}>
            The tag “{tagTitle(takenBy)}” already has this address — use that tag, or type another address.
          </p>
        )}
      </div>
    </FormField>
  );
}

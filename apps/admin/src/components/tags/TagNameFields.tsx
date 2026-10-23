import { TAG_NAME_MAX_LENGTH, TAG_NAME_MIN_LENGTH } from '@football-portal/validation';
import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { FormField } from '@/components/post-form/FormField';
import { controlProps } from '@/components/post-form/formStyles';

const NAME_LENGTH_HINT = `${TAG_NAME_MIN_LENGTH}–${TAG_NAME_MAX_LENGTH} characters`;

interface TagNameFieldsProps {
  /** Префікс id полів: на сторінці тегів — дві форми, новий тег і перейменування */
  idPrefix: string;
  nameEn: UseFormRegisterReturn<'nameEn'>;
  nameUk: UseFormRegisterReturn<'nameUk'>;
  errors: { nameEn?: string; nameUk?: string };
  /** Підказка під українською назвою, якщо потрібна інша, ніж для нового тегу */
  ukHint?: string;
  /** Під англійською назвою — попередження, що так звуть клуб чи турнір */
  enNote?: ReactNode;
}

/** Назви тегу (D45, D51): англійська й українська — обидві обов'язкові; простий текст. */
export function TagNameFields({ idPrefix, nameEn, nameUk, errors, ukHint, enNote }: TagNameFieldsProps) {
  const enFieldId = `${idPrefix}-name-en`;
  const ukFieldId = `${idPrefix}-name-uk`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <FormField
          fieldId={enFieldId}
          label="English name"
          error={errors.nameEn}
          hint={`${NAME_LENGTH_HINT}: a topic like “Transfers”. The address is made from it.`}
        >
          <input {...nameEn} {...controlProps(enFieldId, Boolean(errors.nameEn))} lang="en" autoComplete="off" />
        </FormField>
        {enNote}
      </div>
      <FormField
        fieldId={ukFieldId}
        label="Ukrainian name"
        error={errors.nameUk}
        hint={ukHint ?? `${NAME_LENGTH_HINT}: “Трансфери” — shown on pages in Ukrainian.`}
      >
        <input {...nameUk} {...controlProps(ukFieldId, Boolean(errors.nameUk))} lang="uk" autoComplete="off" />
      </FormField>
    </div>
  );
}

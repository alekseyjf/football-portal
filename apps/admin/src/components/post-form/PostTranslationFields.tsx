'use client';

import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { FormField } from './FormField';
import { controlProps } from './formStyles';
import { PostContentEditor } from './PostContentEditor';
import {
  TRANSLATION_FIELD_NAMES,
  translationFieldDeps,
  type PostFormLanguage,
  type PostFormValues,
} from './postFormSchema';
import type { ContentView } from './usePostFormTabs';

const LANGUAGE_HINTS: Record<PostFormLanguage, string> = {
  en: 'Required. The post address is made from the English title.',
  uk: 'Optional: fill in all three fields or none. Without a translation /uk/ shows the English version marked “translation unavailable”.',
};
// Видалити збережений переклад API не дає (P3-5)
const SAVED_TRANSLATION_HINT = 'This translation is saved: it can be corrected, but not removed.';

interface PostTranslationFieldsProps {
  language: PostFormLanguage;
  /** Необов'язковий переклад (українська), який уже збережено: прибрати його не можна */
  isSaved: boolean;
  register: UseFormRegister<PostFormValues>;
  control: Control<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
  contentView: ContentView;
  onContentViewChange: (view: ContentView) => void;
}

/** Переклад новини однією мовою: заголовок і анонс — простий текст, текст — Markdown (D25). */
export function PostTranslationFields({
  language,
  isSaved,
  register,
  control,
  errors,
  contentView,
  onContentViewChange,
}: PostTranslationFieldsProps) {
  const fieldNames = TRANSLATION_FIELD_NAMES[language];
  const registerOptions = { deps: translationFieldDeps(language) };
  const titleError = errors[fieldNames.title]?.message;
  const excerptError = errors[fieldNames.excerpt]?.message;
  const hint = isSaved ? SAVED_TRANSLATION_HINT : LANGUAGE_HINTS[language];

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{hint}</p>
      <FormField fieldId={fieldNames.title} label="Title" error={titleError}>
        <input
          {...register(fieldNames.title, registerOptions)}
          {...controlProps(fieldNames.title, !!titleError)}
          lang={language}
        />
      </FormField>
      <FormField
        fieldId={fieldNames.excerpt}
        label="Excerpt"
        error={excerptError}
        hint="1–2 sentences that add to the title, plain text: the feed card and the description in Google."
      >
        <textarea
          {...register(fieldNames.excerpt, registerOptions)}
          {...controlProps(fieldNames.excerpt, !!excerptError)}
          lang={language}
          rows={2}
        />
      </FormField>
      <PostContentEditor
        language={language}
        view={contentView}
        onViewChange={onContentViewChange}
        register={register}
        control={control}
        errors={errors}
      />
    </div>
  );
}

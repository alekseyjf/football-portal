'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { TabList, tabElementId, tabPanelElementId } from '@/components/TabList';
import { CoverImageFields } from './CoverImageFields';
import { PostSlugField } from './PostSlugField';
import { PostSourceFields } from './PostSourceFields';
import { PostTranslationFields } from './PostTranslationFields';
import { PublicationFields } from './PublicationFields';
import {
  languageHasErrors,
  POST_FORM_LANGUAGES,
  postFormSchema,
  type PostFormLanguage,
  type PostFormValues,
} from './postFormSchema';
import { postFormServerErrorMessage } from './postFormServerError';
import { usePostFormTabs } from './usePostFormTabs';

const LANGUAGE_TABS_ID = 'post-language';
const LANGUAGE_LABELS: Record<PostFormLanguage, string> = { en: 'English', uk: 'Українська' };

interface PostFormProps {
  defaultValues: PostFormValues;
  submitLabel: string;
  pendingLabel: string;
  /** Збереження; кинута помилка — текст над кнопкою */
  onSubmit: (values: PostFormValues) => Promise<void>;
}

/**
 * Форма новини — спільна для створення й редагування (M1.5.2): переклади вкладками мов, адреса, обкладинка,
 * джерело, публікація. Правила полів — `postFormSchema`, тіло запиту будує той, хто зберігає.
 */
export function PostForm({ defaultValues, submitLabel, pendingLabel, onSubmit }: PostFormProps) {
  const router = useRouter();
  const tabs = usePostFormTabs();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<PostFormValues>({ resolver: zodResolver(postFormSchema), defaultValues });

  // Помилка API — у `errors.root`: RHF прибирає її з наступною відправкою, а `isSubmitSuccessful` лишається false
  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      setError('root.server', { type: 'server', message: postFormServerErrorMessage(error) });
    }
  }, tabs.revealFirstError);

  const languageTabs = POST_FORM_LANGUAGES.map((language) => ({
    id: language,
    label: LANGUAGE_LABELS[language],
    hasError: languageHasErrors(errors, language),
  }));

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <section aria-label="Post text" className="rounded-xl border border-gray-800">
        <div className="border-b border-gray-800 px-2">
          <TabList
            label="Language"
            idPrefix={LANGUAGE_TABS_ID}
            tabs={languageTabs}
            activeTab={tabs.activeLanguage}
            onSelect={tabs.setActiveLanguage}
          />
        </div>
        {/* Обидві мови в DOM (неактивна — `hidden`): поля лишаються зареєстрованими, а RHF може їх фокусувати */}
        {POST_FORM_LANGUAGES.map((language) => (
          <div
            key={language}
            role="tabpanel"
            id={tabPanelElementId(LANGUAGE_TABS_ID, language)}
            aria-labelledby={tabElementId(LANGUAGE_TABS_ID, language)}
            hidden={language !== tabs.activeLanguage}
            className="p-4"
          >
            <PostTranslationFields
              language={language}
              register={register}
              control={control}
              errors={errors}
              contentView={tabs.contentViews[language]}
              onContentViewChange={(view) => tabs.setContentView(language, view)}
            />
          </div>
        ))}
      </section>

      <PostSlugField register={register} control={control} errors={errors} />
      <CoverImageFields register={register} control={control} errors={errors} setValue={setValue} />
      <PostSourceFields register={register} errors={errors} />
      <PublicationFields register={register} control={control} errors={errors} />

      {errors.root?.server && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {errors.root.server.message}
        </p>
      )}
      <div className="flex gap-3 pt-2">
        {/* Після успіху — теж вимкнена: поки відкривається список новин, другий клік створив би дубль */}
        <button
          type="submit"
          disabled={isSubmitting || isSubmitSuccessful}
          className="rounded-lg bg-green-600 px-6 py-3 font-semibold transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-800"
        >
          {isSubmitting || isSubmitSuccessful ? pendingLabel : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg bg-gray-800 px-6 py-3 transition-colors hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

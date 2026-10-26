'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AdminLink } from '@/components/AdminLink';
import { TabList, tabElementId, tabPanelElementId } from '@/components/TabList';
import { useLastPostListHref } from '@/hooks/useLastPostListHref';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { AdminPostDetail } from '@/lib/api/types';
import { editorTimeZone } from '@/lib/editorDateTime';
import { CoverImageFields } from './CoverImageFields';
import { PostRelationsFields } from './PostRelationsFields';
import { PostSlugField } from './PostSlugField';
import { PostSourceFields } from './PostSourceFields';
import { PostTranslationFields } from './PostTranslationFields';
import { PostVideoField } from './PostVideoField';
import { PublicationFields } from './PublicationFields';
import {
  hasUkTranslation,
  languageHasErrors,
  POST_FORM_LANGUAGES,
  postFormSchemaFor,
  type PostFormLanguage,
  type PostFormValues,
} from './postFormSchema';
import { postFormServerErrorMessage } from './postFormServerError';
import { usePostFormTabs } from './usePostFormTabs';
import { useVanishedTagsRecovery } from './useVanishedTagsRecovery';

const LANGUAGE_TABS_ID = 'post-language';
const LANGUAGE_LABELS: Record<PostFormLanguage, string> = { en: 'English', uk: 'Українська' };

interface PostFormProps {
  /** Збережена новина, яку редагують; без неї — створення */
  post?: AdminPostDetail;
  /**
   * Поля: порожні для нової, `toPostFormValues(post)` для збереженої. Прийшли інші (новину щойно збережено) —
   * форма бере їх як збережений стан і знову «чиста»
   */
  defaultValues: PostFormValues;
  submitLabel: string;
  pendingLabel: string;
  /** Збереження; кинута помилка — текст над кнопкою */
  onSubmit: (values: PostFormValues) => Promise<void>;
}

/**
 * Форма новини — спільна для створення й редагування: переклади вкладками мов, адреса, обкладинка, відео, джерело,
 * теги, клуби й турніри, публікація. Правила полів — `postFormSchemaFor`, тіло запиту будує той, хто зберігає.
 */
export function PostForm({ post, defaultValues, submitLabel, pendingLabel, onSubmit }: PostFormProps) {
  const tabs = usePostFormTabs();
  const listHref = useLastPostListHref();
  const timeZone = editorTimeZone();
  const isEditing = post !== undefined;
  const isLive = post?.isLive ?? false;
  const schema = useMemo(
    () => postFormSchemaFor({ timeZone, savedValues: isEditing ? defaultValues : undefined, isLive }),
    [timeZone, isEditing, defaultValues, isLive],
  );
  const [hasSaved, setHasSaved] = useState(false);
  // `values`, а не `defaultValues`: після збереження редагування форма скидається до збереженого
  const form = useForm<PostFormValues>({ resolver: zodResolver(schema), values: defaultValues });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful, isDirty },
  } = form;
  // Зміни — відносно збереженого (`values`): поки вони є, вихід зі сторінки питає (D50)
  useUnsavedChangesGuard(isDirty);
  const recoverVanishedTags = useVanishedTagsRecovery({ savedTags: post?.tags ?? [], isEditing, form, submitLabel });

  // Помилка API — у `errors.root`: RHF прибирає її з наступною відправкою, а `isSubmitSuccessful` лишається false
  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      setHasSaved(true);
    } catch (error) {
      // Тег видалили, поки форма була відкрита: форма прибирає його й каже, який саме (D51)
      const message = (await recoverVanishedTags(error)) ?? postFormServerErrorMessage(error, submitLabel);
      setError('root.server', { type: 'server', message });
    }
  }, tabs.revealFirstError);

  const isUkSaved = isEditing && hasUkTranslation(defaultValues);
  const languageTabs = POST_FORM_LANGUAGES.map((language) => ({
    id: language,
    label: LANGUAGE_LABELS[language],
    hasError: languageHasErrors(errors, language),
  }));
  // Створення: після успіху кнопка лишається вимкненою — поки відкривається список новин, другий клік створив би
  // дубль. Редагування: форма лишається на сторінці — кнопка активна, щойно є незбережені зміни
  const isPending = isSubmitting || (!isEditing && isSubmitSuccessful);
  const isSubmitDisabled = isPending || (isEditing && !isDirty);

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
              isSaved={language === 'uk' && isUkSaved}
              register={register}
              control={control}
              errors={errors}
              contentView={tabs.contentViews[language]}
              onContentViewChange={(view) => tabs.setContentView(language, view)}
            />
          </div>
        ))}
      </section>

      <PostSlugField register={register} control={control} errors={errors} post={post} />
      <CoverImageFields register={register} control={control} errors={errors} setValue={setValue} />
      <PostVideoField register={register} errors={errors} />
      <PostSourceFields register={register} errors={errors} />
      <PostRelationsFields control={control} post={post} />
      <PublicationFields register={register} control={control} errors={errors} post={post} timeZone={timeZone} />

      {errors.root?.server && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {errors.root.server.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="rounded-lg bg-green-600 px-6 py-3 font-semibold transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-800"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
        {/* Посилання на останній стан списку, а не `router.back()`: «назад» зі сторінки, відкритої за адресою,
            вивів би з адмінки. Про незбережені зміни питає `AdminLink` */}
        <AdminLink href={listHref} className="rounded-lg bg-gray-800 px-6 py-3 transition-colors hover:bg-gray-700">
          Cancel
        </AdminLink>
        {/* Область оголошень — у DOM завжди: екранний диктор читає зміну її тексту */}
        {isEditing && (
          <p role="status" className="text-sm text-green-400">
            {hasSaved && !isDirty && (
              <>
                <span aria-hidden="true">✓ </span>All changes saved
              </>
            )}
          </p>
        )}
      </div>
    </form>
  );
}

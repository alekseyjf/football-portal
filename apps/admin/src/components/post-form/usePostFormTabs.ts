import { useState } from 'react';
import { flushSync } from 'react-dom';
import type { FieldErrors } from 'react-hook-form';
import {
  firstLanguageWithErrors,
  TRANSLATION_FIELD_NAMES,
  type PostFormLanguage,
  type PostFormValues,
} from './postFormSchema';

/** Текст новини на вкладці мови: поле Markdown чи перегляд. */
export type ContentView = 'write' | 'preview';

/** Відкрита вкладка мови й режим тексту кожною мовою. */
export function usePostFormTabs() {
  const [activeLanguage, setActiveLanguage] = useState<PostFormLanguage>('en');
  const [contentViews, setContentViews] = useState<Record<PostFormLanguage, ContentView>>({
    en: 'write',
    uk: 'write',
  });

  const setContentView = (language: PostFormLanguage, view: ContentView) =>
    setContentViews((views) => ({ ...views, [language]: view }));

  /**
   * Невдала відправка: вкладка мови з першою помилкою (і поле тексту замість перегляду) стає видимою раніше, ніж
   * React Hook Form поставить фокус на поле, — у схованій панелі фокус не спрацює. RHF фокусує синхронно, щойно
   * цей обробник поверне керування, тож `flushSync`: DOM оновлюється одразу.
   */
  const revealFirstError = (errors: FieldErrors<PostFormValues>) => {
    const language = firstLanguageWithErrors(errors);
    if (!language) return;
    flushSync(() => {
      setActiveLanguage(language);
      if (errors[TRANSLATION_FIELD_NAMES[language].content]) setContentView(language, 'write');
    });
  };

  return { activeLanguage, setActiveLanguage, contentViews, setContentView, revealFirstError };
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  commentFormSchema,
  type CommentFormValues,
} from '@football-portal/validation/forms';
import { useTranslations } from 'next-intl';
import { useCommentErrorMessage } from '@/hooks/useCommentErrorMessage';

/** Кому відповідаємо (чип над полем); без `onRemove` прибрати не можна — відповісти в саму гілку нікуди (заглушка). */
export type ComposerAddressee = { name: string; onRemove?: () => void };

type Props = {
  placeholder: string;
  submitLabel: string;
  addressee?: ComposerAddressee | null;
  rows?: number;
  /** Є — зміна свого коментаря (M1.7.4): поле з його текстом; очікування й помилка — про збереження */
  initialContent?: string;
  /** Поле відповіді чи зміни — фокус одразу (курсор у кінці тексту), «Скасувати» закриває */
  autoFocus?: boolean;
  onCancel?: () => void;
  /** Відхилений проміс — помилка API під полем; текст лишається */
  onSubmit: (content: string) => Promise<unknown>;
};

/** Новий коментар, відповідь чи зміна свого: «@Ім'я» адресата — чипом, у текст не потрапляє (D27). */
export function CommentComposer({
  placeholder,
  submitLabel,
  addressee,
  rows = 3,
  initialContent,
  autoFocus,
  onCancel,
  onSubmit,
}: Props) {
  const t = useTranslations('comments');
  const commentErrorMessage = useCommentErrorMessage();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isEditing = initialContent !== undefined;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { content: initialContent ?? '' },
  });
  const { ref: registerContentRef, ...contentField } = register('content');

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!autoFocus || !textarea) return;
    textarea.focus();
    // Зміна коментаря — дописують у кінці, як на YouTube
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [autoFocus]);

  const submit = handleSubmit(async ({ content }) => {
    setSubmitError(null);
    try {
      await onSubmit(content);
      reset();
    } catch (error) {
      setSubmitError(
        commentErrorMessage(error) ?? t(isEditing ? 'editError' : 'genericError'),
      );
    }
  });

  // Кнопка «×» зникає разом із чипом — фокус лишається в полі
  const removeAddressee = () => {
    addressee?.onRemove?.();
    textareaRef.current?.focus();
  };

  return (
    <form onSubmit={submit} noValidate>
      {addressee && (
        <p className="mb-2 inline-flex max-w-full items-center gap-1 rounded-full bg-gray-800 py-1 pl-3 pr-1 text-xs text-gray-300">
          <span className="truncate">{t('replyingTo', { name: addressee.name })}</span>
          {addressee.onRemove && (
            <button
              type="button"
              onClick={removeAddressee}
              aria-label={t('removeAddressee', { name: addressee.name })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
            >
              <span aria-hidden>×</span>
            </button>
          )}
        </p>
      )}
      <textarea
        {...contentField}
        ref={(element) => {
          registerContentRef(element);
          textareaRef.current = element;
        }}
        rows={rows}
        aria-label={placeholder}
        aria-invalid={errors.content ? true : undefined}
        placeholder={placeholder}
        className={`w-full resize-none rounded-xl border bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors
          ${errors.content ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`}
      />
      {errors.content && (
        <p className="mt-1 text-xs text-red-400">{errors.content.message}</p>
      )}
      {submitError && (
        <p role="alert" className="mt-2 text-xs text-amber-400/95">
          {submitError}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm transition-colors hover:bg-gray-700"
          >
            {t('cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-800"
        >
          {isSubmitting ? t(isEditing ? 'saving' : 'posting') : submitLabel}
        </button>
      </div>
    </form>
  );
}

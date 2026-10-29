import { useTranslations } from 'next-intl';

type Props = { focusRef?: (element: HTMLElement | null) => void };

/**
 * Видалений корінь, під яким лишились відповіді (D27): без тексту й автора, відповіді — на місці. Відповісти самій
 * заглушці не можна — лише її живим відповідям.
 */
export function DeletedCommentStub({ focusRef }: Props) {
  const t = useTranslations('comments');
  return (
    <article
      ref={focusRef}
      tabIndex={-1}
      className="rounded-xl border border-dashed border-gray-800 px-4 py-3 text-sm italic text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-green-500 sm:px-5"
    >
      {t('deletedComment')}
    </article>
  );
}

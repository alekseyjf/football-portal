import { useTranslations } from 'next-intl';
import { postSourceLink } from '@/lib/news/post-source';

interface PostSourceLineProps {
  sourceUrl: string | null;
  sourceName: string | null;
}

/** «Джерело: BBC Sport ↗» під текстом новини (D26) — мовою сторінки, як «Фото: …». */
export function PostSourceLine({ sourceUrl, sourceName }: PostSourceLineProps) {
  const t = useTranslations('news');
  const source = postSourceLink({ sourceUrl, sourceName });
  if (!source) return null;

  return (
    <p className="mt-8 text-sm text-gray-400 break-words">
      {t('source')}{' '}
      {source.href ? (
        // Нова вкладка — новина лишається відкритою. Без `noreferrer`: сайт джерела бачить переходи
        // від нас; без `nofollow`: це редакційне цитування, а не реклама
        <a
          href={source.href}
          target="_blank"
          rel="noopener"
          className="text-gray-200 underline underline-offset-2 hover:text-white"
        >
          {source.label}
          <span aria-hidden="true"> ↗</span>
          <span className="sr-only"> {t('opensInNewTab')}</span>
        </a>
      ) : (
        source.label
      )}
    </p>
  );
}

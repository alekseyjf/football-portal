import { useTranslations } from 'next-intl';
import { LinkPendingLabel } from '@/components/layout/LinkPendingLabel';
import { Link } from '@/i18n/navigation';

type Props = {
  title: string;
  /** Мова заголовка: без перекладу — мова оригіналу */
  titleLang: string;
};

const LINK_CLASS = 'hover:text-white hover:underline';

function Separator() {
  return (
    <span aria-hidden="true" className="mx-2 text-gray-600">
      ›
    </span>
  );
}

/**
 * Хлібні крихти «Головна › Новини › заголовок» (M1.6.2). Поточна сторінка — без посилання, з `aria-current`; довгий
 * заголовок обрізає CSS (`truncate`), а не текст: диктор прочитає його повністю. Ті самі пункти — у JSON-LD сторінки.
 */
export function PostBreadcrumbs({ title, titleLang }: Props) {
  const t = useTranslations('news.breadcrumbs');

  return (
    <nav aria-label={t('label')} className="mb-6 text-sm text-gray-400">
      <ol className="flex items-center">
        <li className="shrink-0 whitespace-nowrap">
          <Link href="/" className={LINK_CLASS}>
            <LinkPendingLabel>{t('home')}</LinkPendingLabel>
          </Link>
        </li>
        <li className="shrink-0 whitespace-nowrap">
          <Separator />
          <Link href="/news" className={LINK_CLASS}>
            <LinkPendingLabel>{t('news')}</LinkPendingLabel>
          </Link>
        </li>
        <li className="min-w-0 truncate">
          <Separator />
          <span aria-current="page" lang={titleLang} className="text-gray-300">
            {title}
          </span>
        </li>
      </ol>
    </nav>
  );
}

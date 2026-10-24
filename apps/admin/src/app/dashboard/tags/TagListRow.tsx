import type { AdminTag } from '@/lib/api/types';
import { postCountLabel, tagNameIn, tagTitle } from '@/lib/tagNames';

const ACTION_CLASS = 'text-sm transition-colors';

interface TagListRowProps {
  tag: AdminTag;
  onRename: (tag: AdminTag) => void;
  onDelete: (tag: AdminTag) => void;
}

/** Тег у списку: назви обома мовами (якої бракує — видно), адреса, кількість новин окремою колонкою і дії. */
export function TagListRow({ tag, onRename, onDelete }: TagListRowProps) {
  const title = tagTitle(tag);
  const nameUk = tagNameIn(tag, 'uk');
  return (
    <li className="flex flex-col gap-3 rounded-xl bg-gray-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {/* До 640 px кількість і дії — під назвою, як у списку новин: на 320 px поруч з ними назва не вміщалась би */}
      <div className="min-w-0 sm:flex-1">
        <p className="truncate font-medium" title={title}>
          {title}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-gray-400">
          {nameUk ? (
            <span lang="uk" className="text-gray-300">
              {nameUk}
            </span>
          ) : (
            // Тег, створений в обхід API (D51): на /uk/ — англійська назва
            <span className="text-amber-300">no Ukrainian name</span>
          )}
          <span aria-hidden="true">·</span>
          <span>
            <span className="sr-only">address </span>
            <code className="break-all">{tag.slug}</code>
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {/* Колонка: за нею сортують список — числа одне під одним */}
        <span
          className={`min-w-20 text-sm tabular-nums sm:text-right ${tag.postCount === 0 ? 'text-gray-500' : 'text-gray-300'}`}
        >
          {postCountLabel(tag.postCount)}
        </span>
        {/* Назва тегу — для екранного диктора: інакше в переліку кнопок — сотні однакових «Rename» */}
        <button
          type="button"
          onClick={() => onRename(tag)}
          className={`${ACTION_CLASS} text-green-400 hover:text-green-300`}
        >
          Rename<span className="sr-only"> “{title}”</span>
        </button>
        <button type="button" onClick={() => onDelete(tag)} className={`${ACTION_CLASS} text-red-300 hover:text-red-200`}>
          Delete<span className="sr-only"> “{title}”</span>
        </button>
      </div>
    </li>
  );
}

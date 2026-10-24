import type { ReactNode } from 'react';

/** Рядок знайденого: сутність (вибрати) чи дія після неї (створити тег). */
export interface EntityResultItem {
  elementId: string;
  content: ReactNode;
  /** Уже вибрана — з позначкою, вдруге не вибирається */
  isSelected?: boolean;
  isAction?: boolean;
  choose: () => void;
}

interface EntityResultsProps {
  id: string;
  /** id підпису поля пошуку — він же назва списку */
  labelledBy: string;
  isExpanded: boolean;
  items: readonly EntityResultItem[];
  /** Підсвічений рядок — на нього вказує `aria-activedescendant` поля */
  activeElementId?: string;
  onHighlight: (elementId: string) => void;
}

/**
 * Знайдене під полем пошуку — `listbox` шаблону WAI-ARIA Combobox: фокус лишається в полі (mousedown його не забирає),
 * клік вибирає. У DOM завжди: на нього вказує `aria-controls` поля.
 */
export function EntityResults({ id, labelledBy, isExpanded, items, activeElementId, onHighlight }: EntityResultsProps) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-labelledby={labelledBy}
      hidden={!isExpanded}
      onMouseDown={(event) => event.preventDefault()}
      className="max-h-72 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 py-1"
    >
      {items.map((item) => {
        const isActive = item.elementId === activeElementId;
        return (
          <li
            key={item.elementId}
            id={item.elementId}
            role="option"
            aria-selected={isActive}
            aria-disabled={item.isSelected || undefined}
            onClick={item.isSelected ? undefined : item.choose}
            onMouseMove={item.isSelected ? undefined : () => onHighlight(item.elementId)}
            className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${resultColorClass(item)} ${
              isActive ? 'bg-gray-700' : ''
            }`}
          >
            <span className="min-w-0">{item.content}</span>
            {item.isSelected && <span className="shrink-0 text-xs text-green-400">✓ Added</span>}
          </li>
        );
      })}
    </ul>
  );
}

function resultColorClass(item: EntityResultItem): string {
  if (item.isSelected) return 'text-gray-500';
  if (item.isAction) return 'cursor-pointer border-t border-gray-800 text-green-400';
  return 'cursor-pointer text-gray-100';
}

import type { ReactNode } from 'react';

/** Вибраний — чипом над полем пошуку. */
export interface EntityPickerChip {
  id: string;
  label: ReactNode;
  /** Назва текстом — для кнопки «прибрати» (`Remove Arsenal FC`) */
  name: string;
}

interface EntityChipsProps {
  /** Як назвати список для екранного диктора: «Tags of the post» */
  label: string;
  chips: readonly EntityPickerChip[];
  onRemove: (id: string) => void;
}

/** Вибрані сутності чипами з кнопкою «прибрати». */
export function EntityChips({ label, chips, onRemove }: EntityChipsProps) {
  if (chips.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li
          key={chip.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 py-1 pl-3 pr-1 text-sm text-gray-100"
        >
          <span className="min-w-0 truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemove(chip.id)}
            aria-label={`Remove ${chip.name}`}
            className="shrink-0 rounded-full px-1.5 leading-6 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

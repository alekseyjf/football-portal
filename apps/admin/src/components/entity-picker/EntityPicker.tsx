'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { controlProps } from '@/components/post-form/formStyles';
import { EntityChips, type EntityPickerChip } from './EntityChips';
import { EntityResults, type EntityResultItem } from './EntityResults';

export type { EntityPickerChip } from './EntityChips';

/** Рядок після знайденого, що не вибирає, а робить дію (створити тег): Enter і клік — `onSelect`. */
export interface EntityPickerAction {
  label: ReactNode;
  onSelect: () => void;
}

interface EntityPickerProps<Option> {
  /** Префікс id елементів: поле — `{idPrefix}-search` */
  idPrefix: string;
  label: ReactNode;
  /** Як назвати вибрані для екранного диктора: «Tags of the post» */
  chipsLabel: string;
  chips: readonly EntityPickerChip[];
  onRemove: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  maxLength?: number;
  hint?: ReactNode;
  /** Знайдене для запиту; `null` — показувати нічого (запит закороткий, ще шукаємо) */
  options: readonly Option[] | null;
  getOptionId: (option: Option) => string;
  renderOption: (option: Option) => ReactNode;
  /** Уже вибраний: у знайденому з позначкою, вдруге не вибирається */
  isOptionSelected: (option: Option) => boolean;
  onPick: (option: Option) => void;
  /** Після знайденого — дія (створити тег) */
  action?: EntityPickerAction;
  /** Стан пошуку — кількість знайденого, «шукаємо…», «уточніть запит»: область оголошень, її чують і незрячі */
  status: ReactNode;
  /** Межу досягнуто — пояснення під полем; поле тоді лише для читання, знайдене не показується */
  limitNote?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * Вибір кількох сутностей пошуком (D51) — теги, клуби: чипи вибраних, поле пошуку, знайдене під ним. Шаблон WAI-ARIA
 * Combobox (поле + `listbox`): фокус лишається в полі, ↑ / ↓ — по знайденому, Enter — вибрати підсвічене (Enter у полі
 * інакше відправив би форму новини), Esc — очистити запит. Знайдене — у потоці сторінки, не спливним шаром: без
 * позиціювання й «кліку повз»; ховається, коли фокус іде з поля.
 */
export function EntityPicker<Option>({
  idPrefix,
  label,
  chipsLabel,
  chips,
  onRemove,
  query,
  onQueryChange,
  placeholder,
  maxLength,
  hint,
  options,
  getOptionId,
  renderOption,
  isOptionSelected,
  onPick,
  action,
  status,
  limitNote,
  inputRef,
}: EntityPickerProps<Option>) {
  const ownInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = inputRef ?? ownInputRef;
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [hasFocus, setHasFocus] = useState(false);
  const inputId = `${idPrefix}-search`;
  const labelId = `${idPrefix}-label`;
  const listboxId = `${idPrefix}-results`;
  const hintId = `${idPrefix}-hint`;
  const limitNoteId = `${idPrefix}-limit`;

  const isFull = Boolean(limitNote);
  const shownOptions = isFull ? null : options;
  const shownAction = shownOptions ? action : undefined;
  const pick = (option: Option) => {
    onPick(option);
    onQueryChange('');
    setHighlightedId(null);
  };
  const resultItems: EntityResultItem[] = [
    ...(shownOptions ?? []).map((option) => ({
      elementId: `${idPrefix}-option-${getOptionId(option)}`,
      content: renderOption(option),
      isSelected: isOptionSelected(option),
      choose: () => pick(option),
    })),
    ...(shownAction
      ? [{ elementId: `${idPrefix}-action`, content: shownAction.label, isAction: true, choose: shownAction.onSelect }]
      : []),
  ];
  const selectableItems = resultItems.filter((item) => !item.isSelected);
  const isExpanded = hasFocus && resultItems.length > 0;
  // Підсвічене зникло зі знайденого (новий запит) — перше, яке можна вибрати
  const activeItem = selectableItems.find((item) => item.elementId === highlightedId) ?? selectableItems[0];
  const activeElementId = isExpanded ? activeItem?.elementId : undefined;

  const highlightNext = (step: 1 | -1) => {
    const index = activeItem ? selectableItems.indexOf(activeItem) : -1;
    const nextItem = selectableItems[(index + step + selectableItems.length) % selectableItems.length];
    setHighlightedId(nextItem.elementId);
    document.getElementById(nextItem.elementId)?.scrollIntoView({ block: 'nearest' });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Набір через метод введення (IME): Enter і стрілки — його
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (isExpanded) activeItem?.choose();
    } else if (event.key === 'Escape' && query) {
      event.preventDefault();
      onQueryChange('');
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && isExpanded && selectableItems.length > 0) {
      event.preventDefault();
      highlightNext(event.key === 'ArrowDown' ? 1 : -1);
    }
  };

  const removeChip = (id: string) => {
    onRemove(id);
    // Кнопки, на якій був фокус, уже немає
    searchInputRef.current?.focus();
  };

  const describedBy = [hint ? hintId : null, isFull ? limitNoteId : null].filter(Boolean).join(' ') || undefined;
  const { className: inputClassName, ...inputProps } = controlProps(inputId, false);

  return (
    <div className="space-y-2">
      <EntityChips label={chipsLabel} chips={chips} onRemove={removeChip} />
      <label id={labelId} htmlFor={inputId} className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      <input
        {...inputProps}
        ref={searchInputRef}
        className={`${inputClassName} read-only:cursor-not-allowed read-only:opacity-60`}
        type="text"
        role="combobox"
        aria-expanded={isExpanded}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeElementId}
        aria-describedby={describedBy}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        readOnly={isFull}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
      />
      <EntityResults
        id={listboxId}
        labelledBy={labelId}
        isExpanded={isExpanded}
        items={resultItems}
        activeElementId={activeElementId}
        onHighlight={setHighlightedId}
      />
      <p role="status" className="text-xs text-gray-400">
        {status}
      </p>
      {isFull && (
        <p id={limitNoteId} className="text-xs text-amber-300">
          {limitNote}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
}

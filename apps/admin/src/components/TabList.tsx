'use client';

import type { KeyboardEvent, ReactNode } from 'react';

export interface TabOption<T extends string> {
  id: T;
  label: ReactNode;
  /** Позначка на назві: на вкладці є поле з помилкою */
  hasError?: boolean;
}

interface TabListProps<T extends string> {
  /** Назва групи вкладок для екранного диктора */
  label: string;
  /** Префікс id: вкладка — `{idPrefix}-tab-{id}`, її панель — `{idPrefix}-panel-{id}` */
  idPrefix: string;
  tabs: ReadonlyArray<TabOption<T>>;
  activeTab: T;
  onSelect: (tab: T) => void;
}

export const tabElementId = (idPrefix: string, tab: string) => `${idPrefix}-tab-${tab}`;
export const tabPanelElementId = (idPrefix: string, tab: string) => `${idPrefix}-panel-${tab}`;

/** Клавіші шаблону WAI-ARIA Tabs: стрілки й Home / End — між вкладками, Tab — одразу в панель. */
const KEY_TO_TAB_INDEX: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

/** Вкладки; панелі (`role="tabpanel"` з `tabPanelElementId`) рендерить той, хто їх використовує. */
export function TabList<T extends string>({ label, idPrefix, tabs, activeTab, onSelect }: TabListProps<T>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const toTabIndex = KEY_TO_TAB_INDEX[event.key];
    if (!toTabIndex) return;
    event.preventDefault();
    const nextTab = tabs[toTabIndex(index, tabs.length)];
    onSelect(nextTab.id);
    document.getElementById(tabElementId(idPrefix, nextTab.id))?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabElementId(idPrefix, tab.id)}
            aria-selected={isActive}
            aria-controls={tabPanelElementId(idPrefix, tab.id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'border-green-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
            {tab.hasError && (
              <>
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-500" />
                <span className="sr-only">— has errors</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

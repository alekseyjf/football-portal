'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { FootballLeagueEmblem } from './FootballLeagueEmblem';
import type { CompetitionType, FootballLeagueMeta } from '@/lib/api/types';

type Props = {
  leagues: FootballLeagueMeta[];
  isLoading: boolean;
  isError: boolean;
  selectedLeagueSlug: string;
  /** Зі списку або з дашборду: архівної ліги (`isActive = false`) у списку немає */
  selectedLeague: FootballLeagueMeta | null;
  leagueHref: (leagueSlug: string) => string;
  onSelectLeague: (leagueSlug: string) => void;
};

const LEAGUE_GROUPS: {
  type: CompetitionType;
  headingKey: 'leaguesGroup' | 'cupsGroup';
}[] = [
  { type: 'LEAGUE', headingKey: 'leaguesGroup' },
  { type: 'CUP', headingKey: 'cupsGroup' },
];

/** Ctrl / ⌘ / Shift / середня кнопка — посилання відкриває браузер (нова вкладка тощо). */
function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Перемикач турнірів сайдбару: кнопка + список посилань `?league=`, згрупований «Ліги» /
 * «Кубки» за `type` (порядок усередині — `sortOrder` з API). Посилання справжні — відкриваються
 * в новій вкладці й працюють без JS; звичайний клік перемикає лігу без перезавантаження.
 */
export function FootballLeagueSwitcher({
  leagues,
  isLoading,
  isError,
  selectedLeagueSlug,
  selectedLeague,
  leagueHref,
  onSelectLeague,
}: Props) {
  const tFootball = useTranslations('football');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      toggleButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  // Tab за межі перемикача закриває список. Фокус «у нікуди» (клік мишею) не чіпаємо:
  // Safari не фокусує посилання кліком, і закриття тут зняло б посилання до події `click`
  const closeOnFocusLeave = (event: FocusEvent<HTMLElement>) => {
    const nextFocused = event.relatedTarget;
    if (nextFocused instanceof Node && !event.currentTarget.contains(nextFocused)) {
      setIsOpen(false);
    }
  };

  const chooseLeague = (
    event: MouseEvent<HTMLAnchorElement>,
    leagueSlug: string,
  ) => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    setIsOpen(false);
    toggleButtonRef.current?.focus();
    if (leagueSlug !== selectedLeagueSlug) onSelectLeague(leagueSlug);
  };

  const leagueGroups = LEAGUE_GROUPS.map((group) => ({
    ...group,
    leagues: leagues.filter((league) => league.type === group.type),
  })).filter((group) => group.leagues.length > 0);

  return (
    <nav
      ref={containerRef}
      aria-label={tFootball('switcherLabel')}
      className="relative"
      onBlur={closeOnFocusLeave}
    >
      <button
        ref={toggleButtonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        className="flex w-full items-center gap-3 border border-neutral-800 border-l-4 border-l-red-600 bg-black/85 px-3 py-2.5 text-left transition-colors hover:bg-neutral-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-500"
      >
        <FootballLeagueEmblem
          emblemUrl={selectedLeague?.emblemUrl ?? null}
          fallbackText={selectedLeagueSlug}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-red-500/90">
            {tFootball('switcherLabel')}
          </span>
          <span className="block truncate text-sm font-bold text-white">
            {selectedLeague?.name ?? selectedLeagueSlug}
          </span>
          {selectedLeague?.area && (
            <span className="block truncate text-[11px] text-neutral-500">
              {selectedLeague.area.name}
            </span>
          )}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={[
            'h-4 w-4 shrink-0 fill-neutral-400 transition-transform',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        >
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={menuId}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto border border-neutral-800 bg-neutral-950 py-1 shadow-xl shadow-black/60"
        >
          {isLoading && (
            <p className="px-3 py-3 text-xs text-neutral-500">
              {tFootball('leaguesLoading')}
            </p>
          )}
          {isError && (
            <p className="px-3 py-3 text-xs text-red-400/90">
              {tFootball('leaguesError')}
            </p>
          )}
          {leagueGroups.map((group) => {
            const headingId = `${menuId}-${group.type}`;
            return (
              <div key={group.type} className="py-1">
                <p
                  id={headingId}
                  className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500"
                >
                  {tFootball(group.headingKey)}
                </p>
                <ul aria-labelledby={headingId}>
                  {group.leagues.map((league) => {
                    const isSelected = league.slug === selectedLeagueSlug;
                    return (
                      <li key={league.slug}>
                        <a
                          href={leagueHref(league.slug)}
                          aria-current={isSelected ? 'true' : undefined}
                          onClick={(event) => chooseLeague(event, league.slug)}
                          className={[
                            'flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors',
                            'hover:bg-neutral-900 focus-visible:bg-neutral-900 focus-visible:outline-none',
                            isSelected
                              ? 'border-l-red-600 bg-neutral-900/70 font-semibold text-white'
                              : 'border-l-transparent text-neutral-300',
                          ].join(' ')}
                        >
                          <FootballLeagueEmblem
                            emblemUrl={league.emblemUrl}
                            fallbackText={league.slug}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {league.name}
                          </span>
                          {league.area && (
                            <span className="shrink-0 text-[11px] text-neutral-500">
                              {league.area.name}
                            </span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}

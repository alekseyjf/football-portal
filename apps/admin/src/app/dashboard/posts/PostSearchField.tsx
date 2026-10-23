'use client';

import { ADMIN_POSTS_SEARCH_MAX_LENGTH } from '@football-portal/validation';
import { useEffect, useRef, useState } from 'react';
import { replacePostListSearch } from '@/hooks/usePostListUrl';
import { normalizePostListSearch } from '@/lib/postListParams';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_INPUT_ID = 'post-search';

/** В адресу — не кожна літера, а пауза в наборі; Enter — одразу. */
function useDebouncedSearch() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return {
    schedule: (value: string) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => replacePostListSearch(value), SEARCH_DEBOUNCE_MS);
    },
    applyNow: (value: string) => {
      clearTimeout(timerRef.current);
      replacePostListSearch(value);
    },
  };
}

/** Пошук у заголовках будь-якою мовою (D47); в адресі — `?search=` без пробілів по краях, порожній — без параметра. */
export function PostSearchField({ search }: { search: string }) {
  const [query, setQuery] = useState(search);
  const [lastUrlSearch, setLastUrlSearch] = useState(search);
  // Пошук в адресі змінився не з поля («Назад», «Show all posts») — поле показує його. Записане самим полем не
  // чіпаємо: щойно набраний пробіл у кінці не зникає
  if (search !== lastUrlSearch) {
    setLastUrlSearch(search);
    if (normalizePostListSearch(query) !== search) setQuery(search);
  }
  const { schedule, applyNow } = useDebouncedSearch();

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        applyNow(query);
      }}
      className="w-full sm:w-64"
    >
      <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
        Search posts by title
      </label>
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          schedule(event.target.value);
        }}
        maxLength={ADMIN_POSTS_SEARCH_MAX_LENGTH}
        placeholder="Search by title…"
        autoComplete="off"
        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-green-500"
      />
    </form>
  );
}

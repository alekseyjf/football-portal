'use client';

import {
  ADMIN_CLUBS_SEARCH_MAX_LENGTH,
  ADMIN_CLUBS_SEARCH_MIN_LENGTH,
  ADMIN_CLUBS_SEARCH_RESULTS_MAX,
  POST_RELATION_IDS_MAX,
} from '@football-portal/validation';
import { useState } from 'react';
import { useController, type Control } from 'react-hook-form';
import { EntityPicker } from '@/components/entity-picker/EntityPicker';
import { hasLatinLetterOrDigit, isClubSearchText, useAdminClubSearch } from '@/hooks/useAdminClubSearch';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AdminClubSearchResult, ClubRef } from '@/lib/api/types';
import type { PostFormValues } from './postFormSchema';
import { isRelationLimitReached, withoutRelationId, withRelationId } from './postRelations';

/** Пауза у вводі перед запитом до API — не на кожну літеру. */
const CLUB_SEARCH_DELAY_MS = 400;
const CLUB_NAME_COLLATOR = new Intl.Collator('en');

interface PostClubsFieldProps {
  control: Control<PostFormValues>;
  /** Клуби збереженої новини — назви чипів */
  savedClubs: readonly ClubRef[];
  /** Клуби, вибрані пошуком у цій формі, — назви чипів і турніри «у грі» для підказки (D46) */
  pickedClubs: ReadonlyMap<string, AdminClubSearchResult>;
  onClubPicked: (club: AdminClubSearchResult) => void;
}

/**
 * Клуби новини (D48, D51): пошук серед клубів з футбольних даних — запитом до API після паузи у вводі, латиницею
 * (назви клубів — англійською, D42); чипи — за назвою.
 */
export function PostClubsField({ control, savedClubs, pickedClubs, onClubPicked }: PostClubsFieldProps) {
  const { field } = useController({ control, name: 'clubIds' });
  const [query, setQuery] = useState('');
  const searchText = query.trim();
  const debouncedSearch = useDebouncedValue(searchText, CLUB_SEARCH_DELAY_MS);
  const search = useAdminClubSearch(debouncedSearch);
  // Знайдене — лише для того, що зараз у полі: поки триває пауза у вводі, старі результати не показуємо
  const isCurrentSearch = isClubSearchText(searchText) && debouncedSearch === searchText;
  const results = isCurrentSearch ? search.data : undefined;

  const selectedIds = field.value;
  const clubById = (id: string) => pickedClubs.get(id) ?? savedClubs.find((club) => club.id === id);
  const selectedClubs = selectedIds
    .flatMap((id) => clubById(id) ?? [])
    .sort((first, second) => CLUB_NAME_COLLATOR.compare(first.name, second.name));

  const pickClub = (club: AdminClubSearchResult) => {
    field.onChange(withRelationId(field.value, club.id));
    onClubPicked(club);
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-800 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">Clubs</legend>
      <EntityPicker
        idPrefix="post-clubs"
        label="Find a club"
        chipsLabel="Clubs of the post"
        chips={selectedClubs.map((club) => ({
          id: club.id,
          label: <ClubName club={club} />,
          name: club.name,
        }))}
        onRemove={(id) => field.onChange(withoutRelationId(field.value, id))}
        query={query}
        onQueryChange={setQuery}
        placeholder="Name, short name or code: arsenal, man united, PSG"
        maxLength={ADMIN_CLUBS_SEARCH_MAX_LENGTH}
        hint="Only the clubs the post is about, not every club mentioned. Search in Latin letters: club names come from the football data in English — “shakhtar” finds FK Shakhtar Donetsk."
        options={results ?? null}
        getOptionId={(club) => club.id}
        renderOption={(club) => <ClubOption club={club} />}
        isOptionSelected={(club) => selectedIds.includes(club.id)}
        onPick={pickClub}
        status={clubSearchStatus({
          searchText,
          results,
          hasFailed: isCurrentSearch && search.isError,
        })}
        limitNote={
          isRelationLimitReached(selectedIds)
            ? `${POST_RELATION_IDS_MAX} clubs is the maximum — remove one to add another.`
            : undefined
        }
      />
    </fieldset>
  );
}

function ClubName({ club }: { club: ClubRef }) {
  return (
    <span className="inline-flex items-center gap-2">
      <ClubCrest crestUrl={club.crestUrl} />
      {club.name}
    </span>
  );
}

function ClubOption({ club }: { club: AdminClubSearchResult }) {
  const shortNames = [club.shortName, club.tla].filter((name) => name && name !== club.name);
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <ClubName club={club} />
      {shortNames.length > 0 && <span className="text-xs text-gray-500">{shortNames.join(' · ')}</span>}
      {club.competitions.length > 0 && (
        <span className="text-xs text-gray-500">
          plays in {club.competitions.map((competition) => competition.name).join(', ')}
        </span>
      )}
    </span>
  );
}

/** Емблема клубу в чипі й у знайденому — лише для впізнавання, тож без опису (назва поруч). */
function ClubCrest({ crestUrl }: { crestUrl: string | null }) {
  if (!crestUrl) return <span aria-hidden="true" className="inline-block h-5 w-5 shrink-0 rounded-full bg-gray-700" />;
  return (
    // Звичайний <img>, як і прев'ю обкладинки: емблеми — з хоста провайдера, без оптимізатора next/image
    // eslint-disable-next-line @next/next/no-img-element
    <img src={crestUrl} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 shrink-0 object-contain" />
  );
}

interface ClubSearchState {
  searchText: string;
  /** Знайдене для того, що в полі; `undefined` — ще шукаємо чи запиту немає */
  results: readonly AdminClubSearchResult[] | undefined;
  hasFailed: boolean;
}

/** Що сказати про пошук клубів — видимо й екранному диктору. */
function clubSearchStatus({ searchText, results, hasFailed }: ClubSearchState): string {
  if (!searchText) return '';
  if (!hasLatinLetterOrDigit(searchText)) {
    return 'Type in Latin letters — club names are in English: “dynamo”, not “Динамо”.';
  }
  if (searchText.length < ADMIN_CLUBS_SEARCH_MIN_LENGTH) {
    return `Type at least ${ADMIN_CLUBS_SEARCH_MIN_LENGTH} characters.`;
  }
  if (hasFailed) return 'Couldn’t search the clubs — check the connection and type again.';
  if (!results) return 'Searching…';
  if (results.length === 0) return `No clubs match “${searchText}”.`;
  if (results.length >= ADMIN_CLUBS_SEARCH_RESULTS_MAX) {
    return `Showing the first ${ADMIN_CLUBS_SEARCH_RESULTS_MAX} clubs — refine your search to find others.`;
  }
  return results.length === 1 ? '1 club found.' : `${results.length} clubs found.`;
}

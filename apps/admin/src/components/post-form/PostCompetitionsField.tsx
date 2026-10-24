'use client';

import { POST_RELATION_IDS_MAX } from '@football-portal/validation';
import { useController, type Control } from 'react-hook-form';
import { useAdminLeagues } from '@/hooks/useAdminLeagues';
import type { AdminClubSearchResult, AdminLeague } from '@/lib/api/types';
import type { PostFormValues } from './postFormSchema';
import { isRelationLimitReached, suggestCompetitions, withoutRelationId, withRelationId } from './postRelations';

const ID_PREFIX = 'post-competition';
const LINK_BUTTON_CLASS = 'text-green-400 underline-offset-2 transition-colors hover:text-green-300 hover:underline';

/** Групи чекбоксів (D51) — за типом турніру, у порядку редакції всередині. */
const COMPETITION_GROUPS: ReadonlyArray<{ type: AdminLeague['type']; label: string }> = [
  { type: 'LEAGUE', label: 'Leagues' },
  { type: 'CUP', label: 'Cups' },
];

const competitionCheckboxId = (competitionId: string) => `${ID_PREFIX}-${competitionId}`;

interface PostCompetitionsFieldProps {
  control: Control<PostFormValues>;
  /** Клуби новини, вибрані пошуком у цій формі: їхні турніри «у грі» форма підказує (D46) */
  pickedClubs: readonly AdminClubSearchResult[];
}

/**
 * Турніри новини (D46, D51): чекбокси всіх турнірів, і вимкнених (новини про завершений ЧС), групами «Ліги» / «Кубки».
 * Вибрали клуб — над ними його турніри «у грі»: додати кліком, самі не додаються.
 */
export function PostCompetitionsField({ control, pickedClubs }: PostCompetitionsFieldProps) {
  const { field } = useController({ control, name: 'competitionIds' });
  const { data: leagues, isError, refetch } = useAdminLeagues();
  const selectedIds = field.value;
  const isFull = isRelationLimitReached(selectedIds);
  const suggestions = leagues ? suggestCompetitions(leagues, pickedClubs, selectedIds) : [];

  const setChecked = (competitionId: string, isChecked: boolean) =>
    field.onChange(
      isChecked ? withRelationId(field.value, competitionId) : withoutRelationId(field.value, competitionId),
    );
  const addSuggested = (competitionId: string) => {
    setChecked(competitionId, true);
    // Кнопки підказки вже немає — фокус на щойно позначений турнір
    document.getElementById(competitionCheckboxId(competitionId))?.focus();
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-800 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">Competitions</legend>
      <p className="text-xs text-gray-500">
        Only the competitions the post is about. On the site the post appears in their news — a club alone doesn’t put
        it there, so add the competition even if its club is picked.
      </p>
      {/* Область оголошень — у DOM завжди: підказка з'являється, щойно вибрали клуб */}
      <div role="status">
        {suggestions.length > 0 && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-gray-300">
            <p>The clubs you picked play in:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((league) => (
                <li key={league.id}>
                  <button
                    type="button"
                    onClick={() => addSuggested(league.id)}
                    disabled={isFull}
                    className="rounded-full border border-green-500/50 px-3 py-0.5 text-green-300 transition-colors hover:bg-green-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span aria-hidden="true">+ </span>
                    <span className="sr-only">Add </span>
                    {league.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {leagues?.length === 0 && <p className="text-sm text-gray-400">No competitions yet.</p>}
      {leagues &&
        COMPETITION_GROUPS.map((group) => (
          <CompetitionGroup
            key={group.type}
            label={group.label}
            leagues={leagues.filter((league) => league.type === group.type)}
            selectedIds={selectedIds}
            isFull={isFull}
            onChange={setChecked}
          />
        ))}
      {!leagues && !isError && <p className="text-sm text-gray-400">Loading competitions…</p>}
      {!leagues && isError && (
        <p className="text-sm text-red-400">
          Couldn’t load the competitions.{' '}
          <button type="button" onClick={() => void refetch()} className={LINK_BUTTON_CLASS}>
            Try again
          </button>
        </p>
      )}
      {leagues?.some((league) => !league.isActive) && (
        <p className="text-xs text-gray-500">
          <InactiveMark /> — not shown on the site now (a finished tournament, for example); posts can still be linked to
          it.
        </p>
      )}
      {isFull && (
        <p className="text-xs text-amber-300">
          {POST_RELATION_IDS_MAX} competitions is the maximum — untick one to add another.
        </p>
      )}
    </fieldset>
  );
}

interface CompetitionGroupProps {
  label: string;
  leagues: readonly AdminLeague[];
  selectedIds: readonly string[];
  isFull: boolean;
  onChange: (competitionId: string, isChecked: boolean) => void;
}

function CompetitionGroup({ label, leagues, selectedIds, isFull, onChange }: CompetitionGroupProps) {
  if (leagues.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {leagues.map((league) => {
          const isChecked = selectedIds.includes(league.id);
          return (
            <label
              key={league.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                isChecked ? 'border-green-500 bg-green-600/10' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <input
                id={competitionCheckboxId(league.id)}
                type="checkbox"
                checked={isChecked}
                disabled={isFull && !isChecked}
                onChange={(event) => onChange(league.id, event.target.checked)}
                className="accent-green-500"
              />
              <span className="min-w-0 text-gray-200">{league.name}</span>
              <span className="text-xs text-gray-500">{league.slug}</span>
              {!league.isActive && <InactiveMark />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function InactiveMark() {
  return <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-amber-300">inactive</span>;
}

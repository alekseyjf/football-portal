'use client';

import { useFootballNameMatches } from '@/hooks/useFootballNameMatches';
import { TAG_WARNING_NOTE_CLASS } from './tagNoteStyles';

/** Скільки назв клубів чи турнірів показати поіменно — решта числом. */
const NAMES_SHOWN = 3;

function joinNames(names: readonly string[]): string {
  if (names.length <= NAMES_SHOWN) return names.join(', ');
  return `${names.slice(0, NAMES_SHOWN).join(', ')} and ${names.length - NAMES_SHOWN} more`;
}

/** «a club: Arsenal FC» / «competitions: …» — що саме так називається. */
function describeMatches(kind: 'club' | 'competition', names: readonly string[]): string | null {
  if (names.length === 0) return null;
  const label = names.length === 1 ? `a ${kind}` : `${kind}s`;
  return `${label}: ${joinNames(names)}`;
}

/**
 * Назва тегу — як у клубу чи турніру (D51): тег — тема новини (трансфери, травми), а клуб і турнір прив'язують
 * своїми полями — так новина потрапляє в «новини клубу / ліги» (D46). Попередження, не заборона: редактор вирішує.
 */
export function FootballNameWarning({ nameEn }: { nameEn: string }) {
  const matches = useFootballNameMatches(nameEn);
  const descriptions = [
    describeMatches('club', matches.clubs.map((club) => club.name)),
    describeMatches('competition', matches.competitions.map((competition) => competition.name)),
  ].filter((description) => description !== null);

  // Область оголошень — у DOM завжди: екранний диктор читає зміну її тексту
  return (
    <div role="status">
      {descriptions.length > 0 && (
        <p className={TAG_WARNING_NOTE_CLASS}>
          Same name as {descriptions.join('; ')}. Clubs and competitions have their own fields in the post form — tags
          are for topics such as transfers or injuries.
        </p>
      )}
    </div>
  );
}

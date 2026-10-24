'use client';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AdminTag } from '@/lib/api/types';
import { findSimilarTags, tagNameIn, tagTitle } from '@/lib/tagNames';
import { TAG_INFO_NOTE_CLASS } from './tagNoteStyles';

/** Пауза у вводі: список і оголошення екранного диктора — не на кожну літеру. */
const SIMILAR_CHECK_DELAY_MS = 300;

interface SimilarTagsNoteProps {
  tags: readonly AdminTag[];
  nameEn: string;
  nameUk: string;
  /** Новий тег — з форми новини: схожий наявний можна вибрати замість нього (D51) */
  onUseTag?: (tag: AdminTag) => void;
}

/** Наявні теги, схожі на назви нового (D51): та сама тема — це наявний тег, новий — лише для нової. */
export function SimilarTagsNote({ tags, nameEn, nameUk, onUseTag }: SimilarTagsNoteProps) {
  const checkedNameEn = useDebouncedValue(nameEn, SIMILAR_CHECK_DELAY_MS);
  const checkedNameUk = useDebouncedValue(nameUk, SIMILAR_CHECK_DELAY_MS);
  const similarTags = findSimilarTags(tags, [checkedNameEn, checkedNameUk]);

  return (
    <div role="status">
      {similarTags.length > 0 && (
        <div className={TAG_INFO_NOTE_CLASS}>
          <p>Similar tags already exist — if the topic is the same, use one of them:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {similarTags.map((tag) => (
              <li key={tag.id}>
                {onUseTag ? (
                  <button
                    type="button"
                    onClick={() => onUseTag(tag)}
                    className="rounded-full border border-gray-600 bg-gray-700 px-2.5 py-0.5 transition-colors hover:border-green-500 hover:bg-gray-600"
                  >
                    <span className="sr-only">Use </span>
                    <SimilarTagName tag={tag} />
                  </button>
                ) : (
                  <span className="inline-block rounded-full bg-gray-700 px-2.5 py-0.5">
                    <SimilarTagName tag={tag} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SimilarTagName({ tag }: { tag: AdminTag }) {
  const nameUk = tagNameIn(tag, 'uk');
  return (
    <>
      {tagTitle(tag)}
      {nameUk && <span lang="uk"> / {nameUk}</span>}
    </>
  );
}

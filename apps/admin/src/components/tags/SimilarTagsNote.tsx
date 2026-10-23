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
}

/** Наявні теги, схожі на назви нового (D51): та сама тема — це наявний тег, новий — лише для нової. */
export function SimilarTagsNote({ tags, nameEn, nameUk }: SimilarTagsNoteProps) {
  const checkedNameEn = useDebouncedValue(nameEn, SIMILAR_CHECK_DELAY_MS);
  const checkedNameUk = useDebouncedValue(nameUk, SIMILAR_CHECK_DELAY_MS);
  const similarTags = findSimilarTags(tags, [checkedNameEn, checkedNameUk]);

  return (
    <div role="status">
      {similarTags.length > 0 && (
        <div className={TAG_INFO_NOTE_CLASS}>
          <p>Similar tags already exist — if the topic is the same, use one of them:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {similarTags.map((tag) => {
              const nameUkOfTag = tagNameIn(tag, 'uk');
              return (
                <li key={tag.id} className="rounded-full bg-gray-700 px-2.5 py-0.5">
                  {tagTitle(tag)}
                  {nameUkOfTag && <span lang="uk"> / {nameUkOfTag}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

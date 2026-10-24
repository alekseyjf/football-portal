'use client';

import { useState } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import type { AdminClubSearchResult, AdminPostDetail } from '@/lib/api/types';
import { PostClubsField } from './PostClubsField';
import { PostCompetitionsField } from './PostCompetitionsField';
import type { PostFormValues } from './postFormSchema';
import { PostTagsField } from './PostTagsField';

interface PostRelationsFieldsProps {
  control: Control<PostFormValues>;
  /** Збережена новина — її теги й клуби чипами; без неї — нова */
  post?: AdminPostDetail;
}

/**
 * Теги, клуби, турніри новини (D51). Клуби — перед турнірами: вибрані пошуком клуби підказують свої турніри «у грі»
 * (D46) — підказка якраз під ними.
 */
export function PostRelationsFields({ control, post }: PostRelationsFieldsProps) {
  // Клуби, вибрані пошуком у цій формі: з турнірами «у грі». У збережених клубів новини їх немає — підказка лише для
  // щойно вибраних
  const [pickedClubs, setPickedClubs] = useState<ReadonlyMap<string, AdminClubSearchResult>>(() => new Map());
  const clubIds = useWatch({ control, name: 'clubIds' });
  const pickedClubsOfPost = clubIds.flatMap((id) => pickedClubs.get(id) ?? []);

  return (
    <>
      <PostTagsField control={control} savedTags={post?.tags ?? []} />
      <PostClubsField
        control={control}
        savedClubs={post?.clubs ?? []}
        pickedClubs={pickedClubs}
        onClubPicked={(club) => setPickedClubs((picked) => new Map(picked).set(club.id, club))}
      />
      <PostCompetitionsField control={control} pickedClubs={pickedClubsOfPost} />
    </>
  );
}

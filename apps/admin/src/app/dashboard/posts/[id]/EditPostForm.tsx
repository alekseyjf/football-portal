'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AdminLink } from '@/components/AdminLink';
import { PostStatusBadge } from '@/components/PostStatusBadge';
import { PostForm } from '@/components/post-form/PostForm';
import { hasPostChanges, toPostFormValues, toUpdatePostRequest } from '@/components/post-form/postFormEdit';
import type { PostFormValues } from '@/components/post-form/postFormSchema';
import { fetchFreshAdminPost } from '@/hooks/useAdminPost';
import { useCreatedPostNotice } from '@/hooks/useCreatedPostNotice';
import { useLastPostListHref } from '@/hooks/useLastPostListHref';
import { useUpdatePost } from '@/hooks/useUpdatePost';
import type { AdminPostDetail } from '@/lib/api/types';
import { editorTimeZone, formatEditorDateTime } from '@/lib/editorDateTime';
import { publicPostUrl } from '@/lib/publicWebUrl';
import { DeletePostSection } from './DeletePostSection';
import { PinPostSection } from './PinPostSection';

/**
 * Редагування новини (D50): форма → `PUT /posts/{id}` лише зі зміненим → свіжа новина з API → форма з нею, на
 * тій самій сторінці. Форма й варіанти статусу — від знімка збереженої новини, а не від даних запиту: фоновий
 * refetch інакше змінив би базу порівняння (і варіанти статусу) під рукою редактора.
 */
export function EditPostForm({ post }: { post: AdminPostDetail }) {
  const queryClient = useQueryClient();
  const timeZone = editorTimeZone();
  const [savedPost, setSavedPost] = useState(post);
  const savedValues = useMemo(() => toPostFormValues(savedPost, timeZone), [savedPost, timeZone]);
  const { mutateAsync: updatePost } = useUpdatePost(savedPost.id);
  const createdNotice = useCreatedPostNotice(post.id);

  const savePost = async (values: PostFormValues) => {
    const request = toUpdatePostRequest(savedValues, values, timeZone);
    if (hasPostChanges(request)) await updatePost(request);
    // Відповідь `PUT` — без текстів: форма бере збережене з API (slug, дата, прибрані опис і назва джерела)
    setSavedPost(await fetchFreshAdminPost(queryClient, savedPost.id));
    // Далі про стан скаже «All changes saved»: «Draft created» могло б уже не відповідати статусу
    createdNotice.hide();
  };

  return (
    <>
      <EditPostHeader
        post={savedPost}
        timeZone={timeZone}
        createdNotice={createdNotice.isShown ? createdNoticeText(savedPost) : null}
      />
      <PostForm
        post={savedPost}
        defaultValues={savedValues}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onSubmit={savePost}
      />
      <PinPostSection post={savedPost} />
      <DeletePostSection post={savedPost} />
    </>
  );
}

/** Щойно створена — зі статусом, з яким її створили. */
function createdNoticeText(post: AdminPostDetail): string {
  if (post.isLive) return 'Post created and published';
  if (post.status === 'SCHEDULED') return 'Post created and scheduled';
  return 'Draft created';
}

interface EditPostHeaderProps {
  post: AdminPostDetail;
  timeZone: string;
  /** Новину щойно створено (з форми створення): що про це сказати; `null` — нічого */
  createdNotice: string | null;
}

function EditPostHeader({ post, timeZone, createdNotice }: EditPostHeaderProps) {
  // Той самий стан списку (фільтр, пошук, сторінка), з якого відкрили новину
  const listHref = useLastPostListHref();
  return (
    <header className="mb-6 space-y-2">
      <AdminLink href={listHref} className="text-sm text-gray-400 transition-colors hover:text-white">
        ← All posts
      </AdminLink>
      <h1 className="text-2xl font-bold">✏️ Edit Post</h1>
      {createdNotice && (
        <p role="status" className="text-sm text-green-400">
          <span aria-hidden="true">✓ </span>
          {createdNotice}
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
        <PostStatusBadge post={post} />
        <span>No. {post.number}</span>
        <span>Saved {formatEditorDateTime(post.updatedAt, timeZone)}</span>
        {/* Лише для живої: чернетка чи запланована на сайті — 404 */}
        {post.isLive && (
          <a
            href={publicPostUrl(post)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 transition-colors hover:text-green-300"
          >
            View on site ↗
          </a>
        )}
      </p>
    </header>
  );
}

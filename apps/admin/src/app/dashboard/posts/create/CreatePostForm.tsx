'use client';

import { useRouter } from 'next/navigation';
import { PostForm } from '@/components/post-form/PostForm';
import {
  EMPTY_POST_FORM_VALUES,
  toCreatePostRequest,
  type PostFormValues,
} from '@/components/post-form/postFormSchema';
import { markPostCreated } from '@/hooks/useCreatedPostNotice';
import { useCreatePost } from '@/hooks/useCreatePost';
import { useLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { editorTimeZone } from '@/lib/editorDateTime';

/**
 * Нова новина: спільна форма → `POST /posts` → сторінка редагування створеної (D50): редактор продовжує там же,
 * а сторінка каже «Draft created».
 */
export function CreatePostForm() {
  const router = useRouter();
  const { mutateAsync: createPost } = useCreatePost();
  const leaveGuard = useLeaveGuard();

  const savePost = async (values: PostFormValues) => {
    const createdPost = await createPost(toCreatePostRequest(values, editorTimeZone()));
    markPostCreated(createdPost.id);
    // Збережено: форма ще «брудна», поки відкривається сторінка редагування, — сторож не питає
    leaveGuard.allowLeave();
    // replace: «Назад» зі сторінки новини веде туди, звідки відкрили створення, а не до порожньої форми
    router.replace(`/dashboard/posts/${createdPost.id}`);
  };

  return (
    <PostForm
      defaultValues={EMPTY_POST_FORM_VALUES}
      submitLabel="Create post"
      pendingLabel="Creating…"
      onSubmit={savePost}
    />
  );
}

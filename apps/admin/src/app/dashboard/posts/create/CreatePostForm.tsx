'use client';

import { useRouter } from 'next/navigation';
import { PostForm } from '@/components/post-form/PostForm';
import {
  EMPTY_POST_FORM_VALUES,
  toCreatePostRequest,
  type PostFormValues,
} from '@/components/post-form/postFormSchema';
import { useCreatePost } from '@/hooks/useCreatePost';

/** Нова новина: спільна форма → `POST /posts` → список новин. */
export function CreatePostForm() {
  const router = useRouter();
  const { mutateAsync: createPost } = useCreatePost();

  const savePost = async (values: PostFormValues) => {
    await createPost(toCreatePostRequest(values));
    router.push('/dashboard/posts');
    router.refresh();
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

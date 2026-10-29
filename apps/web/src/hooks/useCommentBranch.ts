import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CommentItem } from '@/lib/api/types';
import { useCreateComment, useDeleteComment } from './useComments';

/** Поле відповіді — під коментарем, на який натиснули «Відповісти»; `parent` — кому відповідаємо. */
type BranchComposer = { afterCommentId: string; parent: CommentItem };

/**
 * Гілка «корінь + відповіді» (D27): відповіді згорнуті, поле відповіді — одне на гілку. Відповідь на відповідь — з
 * адресатом (чип «×» прибирає його — відповідь іде в саму гілку); своя нова — у кінці розгорнутої гілки, з фокусом.
 */
export function useCommentBranch(postId: string, root: CommentItem) {
  const t = useTranslations('comments');
  const { mutateAsync: createComment } = useCreateComment(postId);
  const { mutate: deleteComment } = useDeleteComment(postId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [composer, setComposer] = useState<BranchComposer | null>(null);
  const [focusReplyId, setFocusReplyId] = useState<string | null>(null);
  // «Скасувати» повертає фокус на «Відповісти», з якої відкрили поле
  const composerOpenerRef = useRef<HTMLElement | null>(null);

  function openComposer(comment: CommentItem) {
    composerOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setComposer({ afterCommentId: comment.id, parent: comment });
  }

  function cancelComposer() {
    setComposer(null);
    composerOpenerRef.current?.focus();
  }

  async function postReply(content: string) {
    if (!composer) return;
    const reply = await createComment({
      content,
      postId,
      parentId: composer.parent.id,
    });
    setComposer(null);
    setIsExpanded(true);
    setFocusReplyId(reply.id);
  }

  function toggleReplies() {
    setIsExpanded((expanded) => !expanded);
    setFocusReplyId(null);
  }

  function deleteWithConfirm(comment: CommentItem) {
    // Корінь з відповідями стає заглушкою — відповіді лишаються (D27)
    const hasReplies = comment.parentId === null && comment.replyCount > 0;
    const question = t(hasReplies ? 'deleteConfirmWithReplies' : 'deleteConfirm');
    if (window.confirm(question)) deleteComment(comment);
  }

  return {
    isExpanded,
    toggleReplies,
    composer,
    openComposer,
    cancelComposer,
    /** «×» на чипі адресата; під заглушкою відповісти в саму гілку не можна — `null` */
    removeAddressee: root.isDeleted
      ? null
      : () => setComposer((current) => current && { ...current, parent: root }),
    postReply,
    deleteWithConfirm,
    focusReplyId,
  };
}

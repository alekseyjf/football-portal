import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { isApiError } from '@/lib/api/http';
import type { AdminPost } from '@/lib/api/types';
import { formServerErrorMessage } from '@/lib/formServerError';
import { pinStepFor } from '@/lib/pinnedPost';
import { fetchCurrentPinnedPost, usePinPost, useUnpinPost } from './usePinPost';

/** Напис кнопки — його згадує повідомлення про сесію, що скінчилась. */
export const PIN_BUTTON_LABEL = 'Pin to home';

const PIN_ERROR_MESSAGES: Record<string, string> = {
  POST_NOT_LIVE: 'Only a post that is on the site can be pinned — reload the page.',
  POST_NOT_FOUND: 'This post was deleted — reload the page.',
  PINNED_POST_CHANGED: 'The home page lead keeps changing — reload the page and try again.',
};

/** Заміна, яку редактор підтверджує: `hasChanged` — закріплена змінилась, поки він вирішував. */
export interface PinReplacement {
  current: AdminPost;
  hasChanged: boolean;
}

/**
 * Pin / Unpin новини (D56). Закріпленої немає — закріплює одразу; є інша — спершу `<dialog>` «замінить {назву}», і
 * в запит іде id саме тієї, яку редактор бачив. Закріплена змінилась (друга вкладка, інший редактор) — 409
 * `PINNED_POST_CHANGED`: перечитати закріплену й спитати заново. Стан — лише з відповіді API.
 */
export function usePinPostAction(postId: string) {
  const queryClient = useQueryClient();
  const pinMutation = usePinPost();
  const unpinMutation = useUnpinPost();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [replacement, setReplacement] = useState<PinReplacement | null>(null);
  const [isCheckingCurrent, setIsCheckingCurrent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showError = (error: unknown) => setErrorMessage(formServerErrorMessage(error, PIN_BUTTON_LABEL, PIN_ERROR_MESSAGES));

  const askToReplace = (nextReplacement: PinReplacement) => {
    // Вміст — до `showModal()`: фокус стає на Cancel уже з назвою новини, а не на порожній діалог
    flushSync(() => setReplacement(nextReplacement));
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  };

  /** Свіжа закріплена → закріпити одразу або спитати; `hasChanged` — це вже друга спроба після 409. */
  const decideAndPin = async (hasChanged: boolean) => {
    const { post: currentPinned } = await fetchCurrentPinnedPost(queryClient);
    const step = pinStepFor(postId, currentPinned);
    if (step.kind === 'confirmReplace') {
      askToReplace({ current: step.current, hasChanged });
      return;
    }
    dialogRef.current?.close();
    await pinMutation.mutateAsync({ postId, replacesPostId: step.replacesPostId });
  };

  /** Закріпити з підтвердженням `replacesPostId`; 409 `PINNED_POST_CHANGED` уперше — спитати заново. */
  const pinReplacing = async (replacesPostId: string | null) => {
    setErrorMessage(null);
    try {
      await pinMutation.mutateAsync({ postId, replacesPostId });
      dialogRef.current?.close();
    } catch (error) {
      if (!isApiError(error) || error.code !== 'PINNED_POST_CHANGED') return showError(error);
      try {
        await decideAndPin(true);
      } catch (retryError) {
        showError(retryError);
      }
    }
  };

  const requestPin = async () => {
    setErrorMessage(null);
    setIsCheckingCurrent(true);
    try {
      const { post: currentPinned } = await fetchCurrentPinnedPost(queryClient);
      const step = pinStepFor(postId, currentPinned);
      if (step.kind === 'confirmReplace') askToReplace({ current: step.current, hasChanged: false });
      else await pinReplacing(step.replacesPostId);
    } catch (error) {
      showError(error);
    } finally {
      setIsCheckingCurrent(false);
    }
  };

  const unpin = () => {
    setErrorMessage(null);
    unpinMutation.mutate(postId, { onError: showError });
  };

  return {
    dialogRef,
    triggerRef,
    replacement,
    errorMessage,
    isPending: isCheckingCurrent || pinMutation.isPending || unpinMutation.isPending,
    requestPin,
    confirmReplacement: () => replacement && pinReplacing(replacement.current.id),
    unpin,
    closeDialog: () => dialogRef.current?.close(),
    /** `onClose` діалогу (і після Esc): вміст прибрати, фокус — назад на кнопку, з якої відкрили */
    handleDialogClose: () => {
      setReplacement(null);
      triggerRef.current?.focus();
    },
  };
}

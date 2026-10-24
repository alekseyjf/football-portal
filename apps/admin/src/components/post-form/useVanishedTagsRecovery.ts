import { useQueryClient } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { adminTagsQueryOptions } from '@/hooks/useAdminTags';
import { isApiError } from '@/lib/api/http';
import type { AdminTag, AdminTagRef } from '@/lib/api/types';
import { tagTitle } from '@/lib/tagNames';
import type { PostFormValues } from './postFormSchema';
import { vanishedTagsMessage } from './postFormServerError';
import { splitVanishedIds } from './postRelations';

interface VanishedTagsRecoveryOptions {
  /** Теги збереженої новини — їхні назви для пояснення */
  savedTags: readonly AdminTagRef[];
  /** Редагування: без інших змін, крім зниклого тегу, зберігати нічого */
  isEditing: boolean;
  form: Pick<UseFormReturn<PostFormValues>, 'getValues' | 'setValue' | 'getFieldState'>;
  submitLabel: string;
}

/**
 * 400 `UNKNOWN_TAG` при збереженні (D51): тег видалили, поки форма була відкрита. Список тегів перечитуємо, зниклі
 * прибираємо з вибраних і пояснюємо, які саме, — наступне збереження пройде. Повертає текст помилки; `null` — помилка
 * інша чи зниклих не знайшлося (список не перечитався), тоді текст — звичайний.
 */
export function useVanishedTagsRecovery({ savedTags, isEditing, form, submitLabel }: VanishedTagsRecoveryOptions) {
  const queryClient = useQueryClient();

  return async (error: unknown): Promise<string | null> => {
    if (!isApiError(error) || error.code !== 'UNKNOWN_TAG') return null;
    const tagsQuery = adminTagsQueryOptions();
    // Назви — з того, що форма бачила досі: у свіжому списку зниклих уже немає
    const knownTags: AdminTagRef[] = [...savedTags, ...(queryClient.getQueryData(tagsQuery.queryKey) ?? [])];
    let freshTags: AdminTag[];
    try {
      freshTags = await queryClient.fetchQuery({ ...tagsQuery, staleTime: 0 });
    } catch {
      // Список не перечитався (мережа): який тег зник, не знати — лишається загальний текст «перезавантажте сторінку»
      return null;
    }
    const { kept, vanished } = splitVanishedIds(form.getValues('tagIds'), freshTags);
    if (vanished.length === 0) return null;
    form.setValue('tagIds', kept, { shouldDirty: true });

    const vanishedNames = vanished.flatMap((id) => {
      const tag = knownTags.find((knownTag) => knownTag.id === id);
      return tag ? [tagTitle(tag)] : [];
    });
    // Стан полів React Hook Form оновлює одразу: змінене поле — «брудне», доки не повернулось до збереженого.
    // Зниклий тег був єдиною зміною збереженої новини — кнопка Save вимкнена, і зберігати нічого
    const fieldNames = Object.keys(form.getValues()) as Array<keyof PostFormValues>;
    const hasChangesToSave = !isEditing || fieldNames.some((fieldName) => form.getFieldState(fieldName).isDirty);
    return vanishedTagsMessage(vanishedNames, hasChangesToSave ? submitLabel : null);
  };
}

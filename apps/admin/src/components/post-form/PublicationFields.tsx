'use client';

import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import {
  fromDateTimeLocalValue,
  scheduleTimeNote,
  timeZoneLabel,
  toDateTimeLocalValue,
} from '@/lib/editorDateTime';
import { FormField } from './FormField';
import { controlProps } from './formStyles';
import {
  DEPENDENT_FIELD_NAMES,
  hasUkText,
  isLivePublication,
  UK_FIELD_NAMES,
  type PostFormValues,
} from './postFormSchema';
import { publicationOptionsFor, type PublicationState } from './publicationOptions';

interface PublicationFieldsProps {
  register: UseFormRegister<PostFormValues>;
  control: Control<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
  /** Збережена новина — від її стану залежать варіанти статусу; без неї — нова */
  post?: PublicationState;
  /** Пояс редактора: у ньому поле дати розкладу */
  timeZone: string;
}

/** Статус публікації й час розкладу; без української версії — попередження (D23). */
export function PublicationFields({ register, control, errors, post, timeZone }: PublicationFieldsProps) {
  const [publication, scheduledAt] = useWatch({ control, name: ['publication', 'scheduledAt'] });
  const ukFieldValues = useWatch({ control, name: UK_FIELD_NAMES });
  const now = new Date();
  const options = publicationOptionsFor(post ?? null, { now, timeZone });
  // Лише попередження, не блок (D23): без UK новина виходить, а термінова не чекає перекладу
  const isPublishingWithoutUk = isLivePublication(publication) && !hasUkText(ukFieldValues);
  // Зсув поясу — на вибрану дату: 26 жовтня Київ уже на UTC+2, хоч сьогодні може бути UTC+3
  const scheduledIso = fromDateTimeLocalValue(scheduledAt, timeZone);
  const zoneLabel = timeZoneLabel(timeZone, scheduledIso ? new Date(scheduledIso) : now);
  // Година, якої немає чи яка буває двічі (перехід часу): поле цього не покаже — пояснюємо, коли саме вийде
  const transitionNote = publication === 'SCHEDULED' ? scheduleTimeNote(scheduledAt, timeZone) : null;

  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-800 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">Publication</legend>
      <div className={`grid gap-2 ${options.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 transition-colors ${
              publication === option.value
                ? 'border-green-500 bg-green-600/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <span className="flex items-center gap-2 text-sm text-gray-200">
              <input
                {...register('publication', { deps: DEPENDENT_FIELD_NAMES.publication })}
                type="radio"
                value={option.value}
                className="accent-green-500"
              />
              {option.label}
            </span>
            <span className="mt-0.5 text-xs text-gray-500">{option.hint}</span>
          </label>
        ))}
      </div>

      {publication === 'SCHEDULED' && (
        <FormField
          fieldId="scheduledAt"
          label={
            <>
              Goes live at <span className="font-normal text-gray-500">({zoneLabel})</span>
            </>
          }
          error={errors.scheduledAt?.message}
        >
          <input
            {...register('scheduledAt')}
            {...controlProps('scheduledAt', !!errors.scheduledAt)}
            type="datetime-local"
            min={toDateTimeLocalValue(now, timeZone)}
          />
          {transitionNote && (
            <p role="status" className="text-xs text-amber-300">
              {transitionNote}
            </p>
          )}
        </FormField>
      )}

      {isPublishingWithoutUk && (
        <p
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          No Ukrainian translation: on /uk/ the post will be shown in English, marked “translation
          unavailable”.
        </p>
      )}
    </fieldset>
  );
}

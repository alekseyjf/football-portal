import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { FormField, OptionalMark } from './FormField';
import { controlProps } from './formStyles';
import type { PostFormValues } from './postFormSchema';

interface PostVideoFieldProps {
  register: UseFormRegister<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
}

/** Відео новини (D54): лише YouTube — посилання з адресного рядка чи кнопки «Поділитися». */
export function PostVideoField({ register, errors }: PostVideoFieldProps) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-gray-800 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">
        Video <OptionalMark />
      </legend>
      <p className="text-xs text-gray-500">
        YouTube only: youtube.com/watch?v=…, youtu.be/…, Shorts or /embed/… links all work and are saved as
        youtube.com/watch?v=…. On the site the video replaces the cover at the top: the cover (without one — the YouTube
        preview) is shown with a play button, the player loads on click.
      </p>
      <FormField fieldId="videoUrl" label="YouTube link" error={errors.videoUrl?.message}>
        <input
          {...register('videoUrl')}
          {...controlProps('videoUrl', !!errors.videoUrl)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </FormField>
    </fieldset>
  );
}

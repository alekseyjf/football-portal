import type { ReactNode } from 'react';
import { fieldErrorId } from './formStyles';

interface FormFieldProps {
  /** id поля — для `<label htmlFor>` і тексту помилки (поле бере його з `controlProps`) */
  fieldId: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}

/** Підпис, поле, помилка й підказка — однаково в усіх блоках форми новини. */
export function FormField({ fieldId, label, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      {children}
      {error && (
        <p id={fieldErrorId(fieldId)} className="text-xs text-red-400">
          {error}
        </p>
      )}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** «(optional)» після назви поля чи блоку. */
export function OptionalMark() {
  return <span className="font-normal text-gray-500">(optional)</span>;
}

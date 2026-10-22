/** id тексту помилки поля — для `aria-describedby`. */
export const fieldErrorId = (fieldId: string) => `${fieldId}-error`;

/**
 * Атрибути поля форми новини: з помилкою — червона рамка, а екранний диктор читає текст помилки разом з полем.
 */
export function controlProps(fieldId: string, hasError: boolean) {
  return {
    id: fieldId,
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasError ? fieldErrorId(fieldId) : undefined,
    className: `w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none border transition-colors ${hasError ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`,
  };
}

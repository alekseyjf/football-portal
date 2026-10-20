/** Поле форми новини; з помилкою — червона рамка. */
export const inputClass = (hasError: boolean) =>
  `w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none border transition-colors ${hasError ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`;

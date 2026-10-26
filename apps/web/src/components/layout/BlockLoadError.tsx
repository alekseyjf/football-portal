type Props = {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
};

/**
 * Блок сторінки не завантажився (frontend, Rule 13): повідомлення й «Спробувати ще» лише для нього — решта сторінки
 * працює (на головній блоки незалежні, D55).
 */
export function BlockLoadError({
  message,
  retryLabel,
  onRetry,
  className = 'py-12',
}: Props) {
  return (
    <div role="alert" className={`text-center ${className}`}>
      <p className="mb-3 text-sm text-red-400/90">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-gray-800 px-4 py-2 text-sm transition-colors hover:bg-gray-700"
      >
        {retryLabel}
      </button>
    </div>
  );
}

const PLACEHOLDER_CLASS = 'animate-pulse rounded bg-neutral-800';

/** Рядків таблиці в заглушці — перший екран сайдбару, а не вся ліга */
const STANDINGS_ROWS = 10;
const ROUND_SECTIONS = 2;

/** Таблиця й тури вантажаться (сервер не дочекався API або «Спробувати ще»): заглушка тієї самої форми. */
export function FootballSidebarSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-5">
      <div className="border border-neutral-800 border-l-4 border-l-red-600 bg-black">
        <div className="space-y-2 border-b border-neutral-800 px-4 py-3">
          <div className={`h-2.5 w-24 ${PLACEHOLDER_CLASS}`} />
          <div className={`h-5 w-32 ${PLACEHOLDER_CLASS}`} />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: STANDINGS_ROWS }, (_, index) => (
            <div key={index} className={`h-5 w-full ${PLACEHOLDER_CLASS}`} />
          ))}
        </div>
      </div>
      {Array.from({ length: ROUND_SECTIONS }, (_, index) => (
        <div key={index} className="space-y-2">
          <div className={`h-3 w-28 ${PLACEHOLDER_CLASS}`} />
          <div className={`h-28 w-full ${PLACEHOLDER_CLASS}`} />
        </div>
      ))}
    </div>
  );
}

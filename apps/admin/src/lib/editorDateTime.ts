/**
 * Дата й час у поясі редактора (пояс браузера). Поле `<input type="datetime-local">` пояс не зберігає
 * (`2026-10-26T10:00`), тож перетворення в ISO з `Z` і назад бере пояс явним параметром: зсув — той, що діє
 * саме в цю дату (26 жовтня Київ уже на UTC+2, хоч 23-го ще UTC+3), і перехід часу перевіряють unit-тести.
 */

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
/** ICU досі віддає старі назви поясів, які IANA перейменувала (2022: Kiev → Kyiv). */
const RENAMED_TIME_ZONE_CITIES: Record<string, string> = { Kiev: 'Kyiv' };

/** Пояс браузера редактора (IANA: `Europe/Kyiv`). */
export function editorTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const partsFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterByTimeZone.get(timeZone);
  if (!formatter) {
    // `hourCycle: 'h23'` — північ як 00, не 24
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsFormatterByTimeZone.set(timeZone, formatter);
  }
  return formatter;
}

/** Миттєвість → значення поля в поясі, з точністю до хвилини: `2026-10-26T08:00Z`, Київ → `2026-10-26T10:00`. */
export function toDateTimeLocalValue(instant: Date, timeZone: string): string {
  const valueByType = new Map(
    partsFormatter(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const part = (type: Intl.DateTimeFormatPartTypes) => valueByType.get(type) ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** Значення поля як UTC (`2026-10-26T10:00` → мс `2026-10-26T10:00Z`); неіснуюча дата (31 лютого) — `null`. */
function wallClockAsUtc(value: string): number | null {
  const parts = DATE_TIME_LOCAL_PATTERN.exec(value);
  if (!parts) return null;
  const [year, month, day, hour, minute] = parts.slice(1).map(Number);
  const wallClock = new Date(0);
  wallClock.setUTCFullYear(year, month - 1, day);
  wallClock.setUTCHours(hour, minute);
  // `Date` «перекочує» зайві дні й години в наступні — таке значення не з поля
  return wallClock.toISOString().slice(0, 16) === value ? wallClock.getTime() : null;
}

/** Зсув поясу від UTC у цю мить, мс (Київ улітку — +3 год). */
function utcOffsetMs(instant: Date, timeZone: string): number {
  const instantMinute = Math.floor(instant.getTime() / MINUTE_MS) * MINUTE_MS;
  return (wallClockAsUtc(toDateTimeLocalValue(instant, timeZone)) ?? instantMinute) - instantMinute;
}

/**
 * Значення поля (час у поясі) → ISO з `Z`; невалідне — `null`. Біля переходу часу — як браузер
 * (`new Date('2026-10-25T03:30')`): година, що повторюється (перехід на зимовий), — перша з двох; година,
 * якої немає (на літній), зсувається вперед на величину переходу.
 */
export function fromDateTimeLocalValue(value: string, timeZone: string): string | null {
  const wallClockTime = wallClockAsUtc(value);
  if (wallClockTime === null) return null;
  // Зсув до переходу й після нього: переходів частіше ніж раз на добу не буває
  const offsetBefore = utcOffsetMs(new Date(wallClockTime - DAY_MS), timeZone);
  const offsetAfter = utcOffsetMs(new Date(wallClockTime + DAY_MS), timeZone);
  const matchingTimes = [wallClockTime - offsetBefore, wallClockTime - offsetAfter].filter(
    (time) => toDateTimeLocalValue(new Date(time), timeZone) === value,
  );
  const instant = matchingTimes.length > 0 ? Math.min(...matchingTimes) : wallClockTime - offsetBefore;
  return new Date(instant).toISOString();
}

/** `UTC+3`, `UTC+5:30`, `UTC-4`, `UTC`. */
function formatUtcOffset(offsetMs: number): string {
  const offsetMinutes = Math.round(offsetMs / MINUTE_MS);
  if (offsetMinutes === 0) return 'UTC';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

/** Пояс біля поля дати: `Kyiv, UTC+3`; зсув — на `instant` (вибрану дату), бо влітку й узимку він різний. */
export function timeZoneLabel(timeZone: string, instant: Date): string {
  const offset = formatUtcOffset(utcOffsetMs(instant, timeZone));
  const city = timeZone.split('/').at(-1)?.replaceAll('_', ' ') ?? timeZone;
  if (city === 'UTC') return offset;
  return `${RENAMED_TIME_ZONE_CITIES[city] ?? city}, ${offset}`;
}

const dateTimeFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

/** Дата для підписів адмінки в поясі редактора: `26 Oct 2026, 10:00`. */
export function formatEditorDateTime(isoDate: string, timeZone: string): string {
  let formatter = dateTimeFormatterByTimeZone.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone });
    dateTimeFormatterByTimeZone.set(timeZone, formatter);
  }
  return formatter.format(new Date(isoDate));
}

/**
 * Час розкладу біля переходу часу: поле `datetime-local` не покаже, що такого часу немає (перехід на літній —
 * година пропадає) чи що він буває двічі (на зимовий), тож форма пояснює, яку мить вибрано (D50). `null` —
 * звичайний час або невалідне значення.
 */
export function scheduleTimeNote(value: string, timeZone: string): string | null {
  const instant = fromDateTimeLocalValue(value, timeZone);
  if (!instant) return null;
  const instantMs = Date.parse(instant);
  const chosen = `${formatEditorDateTime(instant, timeZone)} (${timeZoneLabel(timeZone, new Date(instantMs))})`;
  if (toDateTimeLocalValue(new Date(instantMs), timeZone) !== value) {
    return `No such time: the clocks go forward that night. The post goes live at ${chosen}.`;
  }
  // На скільки переводять годинник назад; та сама година на ньому — ще раз пізніше на цю величину
  const offsetMs = utcOffsetMs(new Date(instantMs), timeZone);
  const shiftBackMs = offsetMs - utcOffsetMs(new Date(instantMs + DAY_MS), timeZone);
  if (shiftBackMs > 0 && toDateTimeLocalValue(new Date(instantMs + shiftBackMs), timeZone) === value) {
    return `This time happens twice: the clocks go back that night. The first one is used — ${chosen}.`;
  }
  return null;
}

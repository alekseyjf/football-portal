/**
 * Календарні дні в поясі користувача (пояс — з next-intl). День у URL — `YYYY-MM-DD` (`?date=`),
 * а API отримує межі дня миттєвостями (`from` / `to`): «10 жовтня» в Києві й у Нью-Йорку —
 * різні інтервали UTC (🧭 п. 3 плану).
 */
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-10-10` — справжня дата (не `2026-02-30`). */
export function isDayKey(value: string): boolean {
  const dateParts = DAY_KEY_PATTERN.exec(value);
  if (!dateParts) return false;
  const [year, month, day] = dateParts.slice(1).map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

function parseDayKey(dayKey: string): [number, number, number] {
  const [year, month, day] = dayKey.split('-').map(Number);
  return [year, month, day];
}

/** Сусідній день: `shiftDayKey('2026-10-31', 1)` → `2026-11-01` (календар, без поясу). */
export function shiftDayKey(dayKey: string, days: number): string {
  const [year, month, day] = parseDayKey(dayKey);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/** Полудень UTC дня — щоб підписати сам день (`formatDateTime(…, 'UTC')`) без зсуву поясом. */
export function dayKeyToUtcNoon(dayKey: string): Date {
  const [year, month, day] = parseDayKey(dayKey);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

const partsFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

/** Складники дати й часу миттєвості в поясі (`hourCycle: 'h23'` — північ як 00, не 24). */
function zonedDateParts(instant: Date, timeZone: string) {
  let formatter = partsFormatterByTimeZone.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterByTimeZone.set(timeZone, formatter);
  }
  const valueByType = new Map(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const partNumber = (type: Intl.DateTimeFormatPartTypes) =>
    Number(valueByType.get(type));
  return {
    year: partNumber('year'),
    month: partNumber('month'),
    day: partNumber('day'),
    hour: partNumber('hour'),
    minute: partNumber('minute'),
    second: partNumber('second'),
  };
}

/** День миттєвості в поясі: `2026-10-09T22:30Z` у Києві (UTC+3) → `2026-10-10`. */
export function dayKeyInTimeZone(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(instant, timeZone);
  return [
    String(year),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

/** Зсув поясу від UTC у цю мить, мс (Київ улітку — +3 год). */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = zonedDateParts(
    instant,
    timeZone,
  );
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Північ дня в поясі → миттєвість. Зсув перевіряється двічі — на випадок переходу на літній час. */
function zonedMidnight(dayKey: string, timeZone: string): Date {
  const [year, month, day] = parseDayKey(dayKey);
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  const firstGuessOffset = timeZoneOffsetMs(new Date(midnightAsUtc), timeZone);
  const firstGuess = midnightAsUtc - firstGuessOffset;
  const actualOffset = timeZoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(midnightAsUtc - actualOffset);
}

/** Межі дня в поясі: `[північ, наступна північ)` — для `GET /football/matches?from=&to=`. */
export function zonedDayRange(
  dayKey: string,
  timeZone: string,
): { from: string; to: string } {
  return {
    from: zonedMidnight(dayKey, timeZone).toISOString(),
    to: zonedMidnight(shiftDayKey(dayKey, 1), timeZone).toISOString(),
  };
}

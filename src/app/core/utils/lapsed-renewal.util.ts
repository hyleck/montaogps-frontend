/**
 * A GPS expired for more than this many days renews from the day the renewal
 * is registered (credit) or paid (cash), not from its old expiration.
 */
export const LAPSED_RENEWAL_DAYS = 60;

/** Dominican calendar day (AAAA-MM-DD) of a form value or stored service date. */
export function serviceCalendarDay(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value as any);
  if (!Number.isFinite(date.getTime())) return null;
  // Midnight-UTC values denote that calendar day; other instants use the
  // Dominican day (UTC-4, no daylight saving).
  const midnightUtc = date.getUTCHours() === 0 && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
  return new Date(date.getTime() - (midnightUtc ? 0 : 4 * 60 * 60_000)).toISOString().slice(0, 10);
}

/** True when the previous expiration is more than LAPSED_RENEWAL_DAYS before `renewalDay`. */
export function isLapsedForRenewal(previousExpiration: unknown, renewalDay: unknown): boolean {
  const previous = serviceCalendarDay(previousExpiration);
  const day = serviceCalendarDay(renewalDay);
  if (!previous || !day) return false;
  return (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86_400_000 > LAPSED_RENEWAL_DAYS;
}

/** Day a renewal counts from: the old expiration, or the renewal day when lapsed or missing. */
export function renewalStartDay(previousExpiration: unknown, renewalDay: unknown): string | null {
  const previous = serviceCalendarDay(previousExpiration);
  const day = serviceCalendarDay(renewalDay);
  if (!previous) return day;
  return isLapsedForRenewal(previous, day) ? day : previous;
}

/** Adds whole years to a calendar day, keeping the day within the month (29/02 → 28/02). */
export function addYearsToCalendarDay(day: string, years: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`La fecha "${day}" no es válida.`);
  const year = Number(match[1]) + years;
  const month = Number(match[2]) - 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(Number(match[3]), lastDay)).padStart(2, '0')}`;
}

/** Today's Dominican calendar day. */
export function todayServiceDay(): string {
  return new Date(Date.now() - 4 * 60 * 60_000).toISOString().slice(0, 10);
}

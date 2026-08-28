/** Preserve form calendar dates stored at UTC midnight without moving them a day back. */
export function parseProcessDisplayDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0{1,3})?Z)?$/.exec(value);
  if (calendarDate) {
    const [, year, month, day] = calendarDate;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.getFullYear() === Number(year)
      && date.getMonth() === Number(month) - 1
      && date.getDate() === Number(day) ? date : null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

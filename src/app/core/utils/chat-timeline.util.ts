export type ChatTimelineDate = Date | string | number | null | undefined;

function toValidDate(value: ChatTimelineDate): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localCalendarDay(date: Date): number {
  // Calendar days, not elapsed 24-hour periods (including DST boundaries).
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function shouldShowChatDateSeparator(
  current: ChatTimelineDate,
  previous?: ChatTimelineDate,
): boolean {
  const currentDate = toValidDate(current);
  if (!currentDate) return false;
  const previousDate = toValidDate(previous);
  return !previousDate || localCalendarDay(currentDate) !== localCalendarDay(previousDate);
}

export function formatChatTimelineDate(value: ChatTimelineDate, today = new Date()): string {
  const date = toValidDate(value);
  if (!date) return 'Fecha desconocida';
  const difference = localCalendarDay(today) - localCalendarDay(date);
  if (difference === 0) return 'Hoy';
  if (difference === 1) return 'Ayer';

  const formatted = new Intl.DateTimeFormat('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

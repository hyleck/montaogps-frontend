import { formatChatTimelineDate, shouldShowChatDateSeparator } from './chat-timeline.util';

describe('chat timeline dates', () => {
  const today = new Date(2026, 7, 28, 12, 0);

  it('shows a separator before the first valid message', () => {
    expect(shouldShowChatDateSeparator(today.toISOString())).toBeTrue();
  });

  it('does not repeat the date for consecutive messages on the same day', () => {
    expect(shouldShowChatDateSeparator(new Date(2026, 7, 28, 23, 59), new Date(2026, 7, 28, 0, 1))).toBeFalse();
  });

  it('shows a separator when messages cross local midnight', () => {
    expect(shouldShowChatDateSeparator(new Date(2026, 7, 28, 0, 1), new Date(2026, 7, 27, 23, 59))).toBeTrue();
  });

  it('distinguishes the same day number in different months and years', () => {
    expect(shouldShowChatDateSeparator(today, new Date(2026, 6, 28, 12))).toBeTrue();
    expect(shouldShowChatDateSeparator(today, new Date(2025, 7, 28, 12))).toBeTrue();
  });

  it('normalizes timestamps with different offsets that represent the same moment', () => {
    expect(shouldShowChatDateSeparator('2026-08-15T02:00:00Z', '2026-08-14T22:00:00-04:00')).toBeFalse();
  });

  it('accepts timestamps in milliseconds as well as Date objects', () => {
    expect(shouldShowChatDateSeparator(today.getTime(), today)).toBeFalse();
  });

  it('does not render separators for missing or invalid dates', () => {
    for (const invalid of [null, undefined, '', 'not-a-date', new Date(NaN), NaN]) {
      expect(shouldShowChatDateSeparator(invalid, today)).toBeFalse();
    }
  });

  it('starts a dated section after a message without a valid date', () => {
    expect(shouldShowChatDateSeparator(today, 'not-a-date')).toBeTrue();
  });

  it('uses Hoy for messages from the current calendar day', () => {
    expect(formatChatTimelineDate(new Date(2026, 7, 28, 0, 0), today)).toBe('Hoy');
  });

  it('uses Ayer across midnight and a year boundary, not elapsed 24-hour periods', () => {
    expect(formatChatTimelineDate(new Date(2026, 7, 27, 23, 59), new Date(2026, 7, 28, 0, 1))).toBe('Ayer');
    expect(formatChatTimelineDate(new Date(2025, 11, 31, 23, 59), new Date(2026, 0, 1, 0, 1))).toBe('Ayer');
  });

  it('uses calendar days around daylight-saving changes', () => {
    expect(formatChatTimelineDate(new Date(2026, 2, 8, 0, 30), new Date(2026, 2, 9, 0, 15))).toBe('Ayer');
  });

  it('formats older dates in Spanish with the year when needed', () => {
    const currentYear = formatChatTimelineDate(new Date(2026, 7, 14, 12), today);
    expect(currentYear).toContain('agosto');
    expect(currentYear).toContain('14');
    expect(currentYear).not.toContain('2026');
    expect(currentYear.charAt(0)).toBe(currentYear.charAt(0).toUpperCase());
    expect(formatChatTimelineDate(new Date(2023, 5, 2, 12), today)).toContain('2023');
  });

  it('handles invalid labels without throwing or inventing a date', () => {
    expect(formatChatTimelineDate('invalid', today)).toBe('Fecha desconocida');
    expect(formatChatTimelineDate(null, today)).toBe('Fecha desconocida');
  });

  it('keeps one separator per day after prepending older messages', () => {
    const dates = [
      new Date(2026, 7, 26, 10), new Date(2026, 7, 26, 12),
      new Date(2026, 7, 27, 8), new Date(2026, 7, 27, 14),
    ];
    const separators = dates.map((date, index) => shouldShowChatDateSeparator(date, dates[index - 1]));
    expect(separators).toEqual([true, false, true, false]);
  });

  it('adds a separator for a live message on the next day, without changing previous dates', () => {
    const dates = [new Date(2026, 7, 27, 23, 59), new Date(2026, 7, 28, 0, 1)];
    const originalTimes = dates.map(date => date.getTime());
    expect(shouldShowChatDateSeparator(dates[1], dates[0])).toBeTrue();
    expect(dates.map(date => date.getTime())).toEqual(originalTimes);
  });
});

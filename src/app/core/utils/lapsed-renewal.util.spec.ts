import { addYearsToCalendarDay, isLapsedForRenewal, renewalStartDay, serviceCalendarDay } from './lapsed-renewal.util';

describe('lapsed renewal rule', () => {
  it('reads form and stored dates as Dominican calendar days', () => {
    expect(serviceCalendarDay('2026-10-13')).toBe('2026-10-13');
    expect(serviceCalendarDay('2026-10-13T04:00:00.000Z')).toBe('2026-10-13');
    expect(serviceCalendarDay('2026-10-13T00:00:00.000Z')).toBe('2026-10-13');
    expect(serviceCalendarDay('2026-10-14T02:00:00.000Z')).toBe('2026-10-13');
  });

  it('renews from the old expiration up to 60 days after it, and from the renewal day after that', () => {
    expect(isLapsedForRenewal('2026-08-05', '2026-10-04')).toBeFalse();
    expect(isLapsedForRenewal('2026-08-05', '2026-10-05')).toBeTrue();
    expect(renewalStartDay('2025-10-13T04:00:00.000Z', '2026-08-04')).toBe('2026-08-04');
    expect(renewalStartDay('2026-09-01', '2026-10-28')).toBe('2026-09-01');
    expect(renewalStartDay('2027-01-01', '2026-10-28')).toBe('2027-01-01');
    expect(renewalStartDay(null, '2026-10-28')).toBe('2026-10-28');
  });

  it('adds years keeping the day within the month', () => {
    expect(addYearsToCalendarDay('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYearsToCalendarDay('2026-08-04', 2)).toBe('2028-08-04');
  });
});

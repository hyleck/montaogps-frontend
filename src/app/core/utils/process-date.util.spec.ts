import { parseProcessDisplayDate } from './process-date.util';

describe('parseProcessDisplayDate', () => {
  for (const value of ['2026-08-26', '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00Z']) {
    it(`preserves the selected calendar day for ${value}`, () => {
      const date = parseProcessDisplayDate(value)!;
      expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()])
        .toEqual([2026, 7, 26, 0]);
    });
  }

  it('preserves real timestamps that include a time', () => {
    const value = '2026-08-26T16:30:00.000Z';
    expect(parseProcessDisplayDate(value)?.toISOString()).toBe(value);
  });

  it('preserves an explicit timezone offset', () => {
    expect(parseProcessDisplayDate('2026-08-26T00:00:00-04:00')?.toISOString())
      .toBe('2026-08-26T04:00:00.000Z');
  });

  it('rejects empty, invalid, and impossible calendar dates', () => {
    for (const value of [null, undefined, '', 'invalid', '2026-02-30', '2026-02-30T00:00:00.000Z']) {
      expect(parseProcessDisplayDate(value)).toBeNull();
    }
  });
});

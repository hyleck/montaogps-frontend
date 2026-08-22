import {
  getGpsDisplayConnectionStatus,
  ONLINE_GRACE_PERIOD_MINUTES,
  WEAK_SIGNAL_MAX_DURATION_MINUTES,
} from './device-connection-status.helper';

describe('device connection status', () => {
  const now = new Date('2026-08-21T01:00:00.000Z').getTime();
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000);

  it('uses the same 10-to-60-minute weak-signal window as Management', () => {
    expect(getGpsDisplayConnectionStatus('offline', minutesAgo(ONLINE_GRACE_PERIOD_MINUTES), now)).toBe('online');
    expect(getGpsDisplayConnectionStatus('offline', minutesAgo(ONLINE_GRACE_PERIOD_MINUTES + 1), now)).toBe('Señal débil');
    expect(getGpsDisplayConnectionStatus('offline', minutesAgo(WEAK_SIGNAL_MAX_DURATION_MINUTES), now)).toBe('Señal débil');
    expect(getGpsDisplayConnectionStatus('offline', minutesAgo(WEAK_SIGNAL_MAX_DURATION_MINUTES + 1), now)).toBe('offline');
  });

  it('preserves explicit online and location-only statuses', () => {
    expect(getGpsDisplayConnectionStatus('online', minutesAgo(120), now)).toBe('online');
    expect(getGpsDisplayConnectionStatus('Localizado', minutesAgo(120), now)).toBe('Localizado');
    expect(getGpsDisplayConnectionStatus('No localizado', minutesAgo(20), now)).toBe('No localizado');
  });

  it('keeps the raw offline status when the last update is unavailable', () => {
    expect(getGpsDisplayConnectionStatus('offline', null, now)).toBe('offline');
  });
});

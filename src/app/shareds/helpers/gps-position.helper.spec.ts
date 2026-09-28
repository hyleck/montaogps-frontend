import { getGpsLocationTimestamp, getValidGpsPosition, getValidTargetPosition, LastValidPositionCache } from './gps-position.helper';

describe('GPS positions displayed on maps', () => {
  const fix = (overrides: any = {}) => ({
    latitude: 19.63116,
    longitude: -70.28124166666667,
    valid: true,
    fixTime: '2026-09-28T13:52:00Z',
    ...overrides,
  });
  const target = (geolocation: any, id = '863874080932787') => ({
    _id: id,
    server_id: 'S2',
    traccarInfo: { geolocation },
  });

  it('rejects invalid fixes even when their coordinates look real', () => {
    for (const valid of [false, 'false', 0, '0']) {
      expect(getValidGpsPosition(fix({ valid }))).toBeNull();
    }
  });

  it('rejects 0,0, malformed, missing, nonfinite and out-of-range coordinates', () => {
    const badCoordinates = [
      [0, 0], ['0', '0'], [null, -70], ['', -70], [' ', -70],
      ['19.6bad', -70], [false, -70], [NaN, -70], [Infinity, -70],
      [91, -70], [19, -181], [undefined, -70],
    ];
    for (const [latitude, longitude] of badCoordinates) {
      expect(getValidGpsPosition(fix({ latitude, longitude }))).toBeNull();
    }
  });

  it('accepts numeric strings, legacy fixes, and a single zero coordinate', () => {
    expect(getValidGpsPosition(fix({ latitude: '19.6', longitude: '-70.2', valid: undefined }))?.lat).toBe(19.6);
    expect(getValidGpsPosition(fix({ latitude: 0 }))?.lat).toBe(0);
    expect(getValidGpsPosition(fix({ longitude: 0 }))?.lng).toBe(0);
  });

  it('finds a valid historical fallback after an invalid live fix', () => {
    const device = { ...target(fix({ latitude: 0, longitude: 0, valid: false })), historicalLocation: fix() };
    expect(getValidTargetPosition(device)?.lat).toBe(19.63116);
  });

  it('keeps the last valid S2 fix when a later report contains invalid 0,0', () => {
    const cache = new LastValidPositionCache();
    cache.resolve(target(fix()));
    const result = cache.resolve(target(fix({ latitude: 0, longitude: 0, valid: false, fixTime: '2026-09-28T14:08:00Z' })));
    expect(result?.lat).toBe(19.63116);
    expect(result?.geo.fixTime).toBe('2026-09-28T13:52:00Z');
  });

  it('shows no marker when there has never been a valid fix', () => {
    expect(new LastValidPositionCache().resolve(target(fix({ valid: false })))).toBeNull();
  });

  it('keeps cached fixes separate between devices and servers', () => {
    const cache = new LastValidPositionCache();
    cache.resolve(target(fix()));
    expect(cache.resolve(target(fix({ valid: false }), 'other'))).toBeNull();
    expect(cache.resolve({ ...target(fix({ valid: false })), server_id: 'S3' })).toBeNull();
  });

  it('protects the fallback when callers mutate the original payload', () => {
    const cache = new LastValidPositionCache();
    const device = target(fix());
    cache.resolve(device);
    device.traccarInfo.geolocation.latitude = 0;
    device.traccarInfo.geolocation.longitude = 0;
    expect(cache.resolve(device)?.geo.latitude).toBe(19.63116);
  });

  it('rejects an impossible jump but recovers on the next coherent fix', () => {
    const cache = new LastValidPositionCache();
    cache.resolve(target(fix()));
    expect(cache.resolve(target(fix({ latitude: 40, longitude: -74, fixTime: '2026-09-28T13:53:00Z' })))?.lat).toBe(19.63116);
    expect(cache.resolve(target(fix({ latitude: 19.63216, fixTime: '2026-09-28T13:54:00Z' })))?.lat).toBe(19.63216);
  });

  it('rejects older fixes and does not use a heartbeat time to justify a jump', () => {
    const cache = new LastValidPositionCache();
    cache.resolve(target(fix()));
    expect(cache.resolve(target(fix({ latitude: 19.63117, fixTime: '2026-09-28T13:51:00Z' })))?.lat).toBe(19.63116);
    expect(cache.resolve(target(fix({ latitude: 19.7, serverTime: '2026-09-29T13:52:00Z' })))?.lat).toBe(19.63116);
  });

  it('uses event time before device time when fix time cannot be parsed', () => {
    const cache = new LastValidPositionCache();
    cache.resolve(target(fix()));
    const position = cache.resolve(target(fix({
      latitude: 19.63216,
      fixTime: 'invalid',
      eventTime: '2026-09-28T13:54:00Z',
      deviceTime: '2026-09-28T13:51:00Z',
    })));
    expect(position?.lat).toBe(19.63216);
  });

  it('continues scanning timestamp fallbacks after malformed values', () => {
    const cache = new LastValidPositionCache();
    cache.resolve(target(fix()));
    const position = cache.resolve(target(fix({
      latitude: 19.63216,
      fixTime: 'invalid',
      eventTime: 'invalid',
      deviceTime: 'invalid',
      timestamp: 'invalid',
      serverTime: '2026-09-28T13:54:00Z',
    })));
    expect(position?.lat).toBe(19.63216);
  });

  it('permits at most 100m jitter without advancing timestamps', () => {
    const cache = new LastValidPositionCache();
    cache.resolve(target(fix({ fixTime: undefined })));
    expect(cache.resolve(target(fix({ latitude: 19.63117, fixTime: undefined })))?.lat).toBe(19.63117);
    expect(cache.resolve(target(fix({ latitude: 19.64, fixTime: undefined })))?.lat).toBe(19.63117);
  });

  it('preserves a known fix timestamp across a reduced payload so movement can resume', () => {
    const cache = new LastValidPositionCache();
    cache.resolve(target(fix()));
    const reduced = cache.resolve(target(fix({ latitude: 19.63117, fixTime: undefined })));
    expect(reduced?.geo.fixTime).toBe('2026-09-28T13:52:00Z');
    expect(cache.resolve(target(fix({ latitude: 19.63216, fixTime: '2026-09-28T13:54:00Z' })))?.lat).toBe(19.63216);
  });

  it('prefers the locationTime attached to the accepted position', () => {
    const position = getValidGpsPosition(fix({ locationTime: '2026-09-28T13:50:00Z' }));
    expect(getGpsLocationTimestamp(position)).toBe(Date.parse('2026-09-28T13:50:00Z'));
  });

  it('keeps the normalized fix date for trackers with a corrected protocol timezone', () => {
    const position = getValidGpsPosition(fix({
      timeQuality: 'fix',
      fixTime: '2026-09-28T21:52:00Z',
      eventTime: '2026-09-28T13:52:00Z',
    }));
    expect(getGpsLocationTimestamp(position)).toBe(Date.parse('2026-09-28T13:52:00Z'));
  });

  it('never borrows receipt or communication timestamps for a location date', () => {
    const position = getValidGpsPosition(fix({
      fixTime: undefined,
      serverTime: '2026-09-28T14:24:00Z',
      lastUpdate: '2026-09-28T14:24:00Z',
    }));
    expect(getGpsLocationTimestamp(position)).toBeNull();
    expect(getGpsLocationTimestamp(null)).toBeNull();
  });

  it('preserves an explicitly unknown backend location date and ignores receipt-based event time', () => {
    expect(getGpsLocationTimestamp(getValidGpsPosition(fix({ locationTime: null })))).toBeNull();
    expect(getGpsLocationTimestamp(getValidGpsPosition(fix({
      fixTime: undefined, timeQuality: 'server', eventTime: '2026-09-28T14:24:00Z',
    })))).toBeNull();
  });
});

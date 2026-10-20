import { getMovingSpeedKmh, isMovingSpeedKnots } from './device-movement.helper';

describe('Device movement', () => {
  const now = new Date('2026-10-20T15:00:00Z').getTime();
  const info = (speedKnots: number, overrides: any = {}, fixTime = '2026-10-20T14:58:00Z') => ({
    status: 'online',
    lastUpdate: fixTime,
    geolocation: { latitude: 19.45, longitude: -70.69, valid: true, speed: speedKnots, fixTime },
    ...overrides,
  });

  it('returns the speed of a recent moving position', () => {
    expect(getMovingSpeedKmh(info(20), now)).toBe(37);
  });

  it('ignores GPS drift on a parked vehicle', () => {
    expect(getMovingSpeedKmh(info(1.5), now)).toBe(0);
  });

  it('ignores the speed of an offline device last position', () => {
    expect(getMovingSpeedKmh(info(30, { status: 'offline' }), now)).toBe(0);
  });

  it('accepts a weak signal device', () => {
    expect(getMovingSpeedKmh(info(30, { status: 'Señal débil' }), now)).toBe(56);
  });

  it('ignores the speed of a position older than 10 minutes', () => {
    expect(getMovingSpeedKmh(info(30, {}, '2026-10-20T14:40:00Z'), now)).toBe(0);
  });

  it('accepts a fix slightly ahead of the browser clock', () => {
    expect(getMovingSpeedKmh(info(30, {}, '2026-10-20T15:03:00Z'), now)).toBe(56);
  });

  it('falls back to lastLocation', () => {
    const { geolocation, ...rest } = info(30) as any;
    expect(getMovingSpeedKmh({ ...rest, lastLocation: geolocation }, now)).toBe(56);
  });
});

describe('History movement', () => {
  it('treats history speeds under ~5 km/h as parked drift', () => {
    expect(isMovingSpeedKnots(0)).toBeFalse();
    expect(isMovingSpeedKnots(1.6)).toBeFalse();
    expect(isMovingSpeedKnots(2.7)).toBeTrue();
    expect(isMovingSpeedKnots(30)).toBeTrue();
    expect(isMovingSpeedKnots(undefined)).toBeFalse();
  });
});

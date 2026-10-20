import { getGpsLocationTimestamp, getValidGpsPosition } from './gps-position.helper';

/** Below this speed a parked GPS can report drift, so it is not treated as moving. */
export const MIN_MOVING_SPEED_KMH = 5;
/** A last position older than this does not describe what the vehicle is doing now. */
export const MAX_MOVING_POSITION_AGE_MS = 10 * 60 * 1000;

/** History positions carry Traccar speed in knots; ~5 km/h. */
export const MIN_MOVING_SPEED_KNOTS = MIN_MOVING_SPEED_KMH / 1.852;

export function isMovingSpeedKnots(speed: unknown): boolean {
  const knots = Number(speed);
  return Number.isFinite(knots) && knots >= MIN_MOVING_SPEED_KNOTS;
}

const REPORTING_STATUSES = ['online', 'señal débil'];

function currentLocation(traccarInfo: any): any {
  return traccarInfo?.geolocation ?? traccarInfo?.lastLocation ?? null;
}

function rawSpeedKmh(traccarInfo: any): number {
  const knots = Number(currentLocation(traccarInfo)?.speed ?? 0);
  return Number.isFinite(knots) && knots > 0 ? Math.round(knots * 1.852) : 0;
}

function positionTimestamp(traccarInfo: any): number | null {
  const location = currentLocation(traccarInfo);
  const fix = getGpsLocationTimestamp(getValidGpsPosition(location));
  if (fix !== null) return fix;
  for (const value of [location?.serverTime, traccarInfo?.lastUpdate]) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) return time;
  }
  return null;
}

export function hasRecentPosition(traccarInfo: any, now = Date.now()): boolean {
  if (!REPORTING_STATUSES.includes(String(traccarInfo?.status || '').toLowerCase())) return false;
  const time = positionTimestamp(traccarInfo);
  // A clock running ahead still means a fresh position.
  return time !== null && now - time <= MAX_MOVING_POSITION_AGE_MS;
}

/** Current speed in km/h, or 0 unless a reporting device sent a recent position above drift. */
export function getMovingSpeedKmh(traccarInfo: any, now = Date.now()): number {
  const speedKmh = rawSpeedKmh(traccarInfo);
  return speedKmh >= MIN_MOVING_SPEED_KMH && hasRecentPosition(traccarInfo, now) ? speedKmh : 0;
}

/** Connection color and label; a weak signal device is still reporting, not disconnected. */
export function getConnectionDisplay(status: unknown): { color: string; label: string } {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'online') return { color: '#4CAF50', label: 'Conectado' };
  if (normalized === 'señal débil') return { color: '#FF9800', label: 'Señal débil' };
  return { color: '#F44336', label: 'Desconectado' };
}

export function isReportingStatus(status: unknown): boolean {
  return REPORTING_STATUSES.includes(String(status || '').toLowerCase());
}

export interface MapPosition {
  lat: number;
  lng: number;
  geo: any;
}

function coordinate(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A missing legacy validity flag is allowed; an explicit invalid fix never is. */
export function getValidGpsPosition(location: any): MapPosition | null {
  if (!location || [false, 0, 'false', '0'].includes(location.valid)) return null;
  const lat = coordinate(location.latitude ?? location.lat ?? location.Lat ?? location.latitud);
  const lng = coordinate(location.longitude ?? location.lng ?? location.lon ?? location.Long ?? location.longitud);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng, geo: location };
}

export function getValidTargetPosition(target: any): MapPosition | null {
  const sources = [target, target?.originalTarget].filter(Boolean);
  for (const source of sources) {
    const candidates = [
      source.traccarInfo?.geolocation,
      source.traccarInfo?.lastLocation,
      source.traccarInfo?.last_location,
      source.traccarInfo?.position,
      source.historicalLocation,
      source.lastLocation,
      source.last_location,
      source.geolocation,
      source.position,
      source.lastPosition,
      source.traccarInfo,
      source,
    ];
    for (const candidate of candidates) {
      const position = getValidGpsPosition(candidate);
      if (position) return position;
    }
  }
  return null;
}

function fixTimestamp(position: MapPosition): number | null {
  const geo = position.geo;
  for (const value of [geo.fixTime, geo.eventTime, geo.deviceTime, geo.timestamp, geo.serverTime]) {
    if (value == null || value === '') continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

/** The location's capture time; communication/receipt timestamps are never a GPS fix date. */
export function getGpsLocationTimestamp(position: MapPosition | null): number | null {
  if (!position) return null;
  const geo = position.geo;
  if (geo.locationTime !== undefined) {
    if (geo.locationTime == null || geo.locationTime === '') return null;
    const timestamp = new Date(geo.locationTime).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  const fixFields = geo.timeQuality === 'fix'
    ? [geo.eventTime, geo.fixTime, geo.deviceTime]
    : [geo.fixTime, geo.timeQuality === 'server' ? null : geo.eventTime, geo.deviceTime];
  for (const value of fixFields) {
    if (value == null || value === '') continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

export function isCoherentGpsPosition(position: MapPosition, previous: MapPosition): boolean {
  const radians = Math.PI / 180;
  const dLat = (position.lat - previous.lat) * radians;
  const dLng = (position.lng - previous.lng) * radians;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(previous.lat * radians) * Math.cos(position.lat * radians) * Math.sin(dLng / 2) ** 2;
  const distanceMeters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  const currentTime = fixTimestamp(position);
  const previousTime = fixTimestamp(previous);
  if (currentTime !== null && previousTime !== null && currentTime < previousTime) return false;
  // Permit normal GPS jitter, including repeated fixes without a timestamp.
  if (distanceMeters <= 100) return true;
  if (currentTime === null || previousTime === null || currentTime <= previousTime) return false;
  return distanceMeters / (currentTime - previousTime) * 3600 <= 220;
}

/** Keep the last usable fix per device while live reports lose their GPS fix. */
export class LastValidPositionCache {
  private positions = new Map<string, MapPosition>();

  resolve(target: any): MapPosition | null {
    const source = target?.originalTarget || target;
    const id = source?._id || source?.id || source?.device_imei || source?.imei;
    const key = id == null ? null : `${source?.server_id || ''}:${id}`;
    const position = getValidTargetPosition(target);
    const previous = key ? this.positions.get(key) : undefined;
    // A reduced/status payload must not discard the timestamp needed to verify the next movement.
    if (position && previous && fixTimestamp(previous) !== null && fixTimestamp(position) === null) {
      return previous;
    }
    if (position && (!previous || isCoherentGpsPosition(position, previous))) {
      // Copy the fix so a caller mutating the target cannot poison the fallback.
      if (key) this.positions.set(key, { ...position, geo: { ...position.geo } });
      return position;
    }
    return previous || null;
  }
}

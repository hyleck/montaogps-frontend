export interface SmsLocation {
  latitude: number;
  longitude: number;
  url: string;
}

type Axis = 'latitude' | 'longitude';
interface Coordinate { value: number; decimal: boolean; hemisphere: boolean; }
interface Candidate { index: number; location: SmsLocation; }

const NUMBER = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const COORDINATE = new RegExp(`^\\s*([NSEWO])?\\s*(${NUMBER})\\s*°?\\s*([NSEWO])?\\s*$`, 'i');
const LABELED_VALUE = new RegExp(
  `^\\s*(?:[NSEWO]\\s*)?${NUMBER}(?:\\s*°)?(?:\\s*[NSEWO](?![A-Za-z0-9_:=]))?(?=$|[\\s,;|#)\\]]|\\.(?=$|\\s))`, 'i',
);
const LABEL = /\b(latitude|latitud|lat|longitude|longitud|long|lng|lon)\b\s*(?::|=)?\s*/gi;
const URL_TOKEN = /(?:[a-z][a-z0-9+.-]*:\/\/|(?<![\w.@/-])(?:www\.)?(?:maps\.)?google\.com\/)[^\s<>"']+/gi;
const LOCATION_PREFIX = /^(?:gps|coordinates|coordenadas|location|ubicaci[oó]n|position|posici[oó]n|loc)(?:\s*[:=]\s*|\s+)/i;

/** Extracts a decimal GPS fix without changing or rendering the original SMS. */
export function extractSmsLocation(content: unknown): SmsLocation | null {
  if (typeof content !== 'string' || !content.trim() || content.length > 65536) return null;
  const candidates: Candidate[] = [];

  // Remove every URL from plain-text parsing, including untrusted domains and
  // schemes. Numeric query parameters must never be mistaken for a bare fix.
  const plain = content.replace(URL_TOKEN, (value, index: number) => {
    const location = locationFromGoogleUrl(value);
    if (location) candidates.push({ index, location });
    return ' '.repeat(value.length);
  });
  const labels = Array.from(plain.matchAll(new RegExp(LABEL.source, LABEL.flags))).map(match => ({
    axis: (match[1].toLowerCase().startsWith('lat') ? 'latitude' : 'longitude') as Axis,
    index: match.index!, end: match.index! + match[0].length,
  }));

  if (labels.length) {
    // Labels define the axes even when longitude appears first. Do not salvage
    // unlabeled numbers from an incomplete or invalid labeled coordinate pair.
    for (let index = 0; index + 1 < labels.length; index += 2) {
      const first = labels[index];
      const second = labels[index + 1];
      if (first.axis === second.axis) break;
      const a = labeledCoordinate(plain.slice(first.end, second.index), first.axis);
      const b = labeledCoordinate(plain.slice(second.end, labels[index + 2]?.index), second.axis);
      if (!a || !b) continue;
      const location = makeLocation(first.axis === 'latitude' ? a.value : b.value, first.axis === 'longitude' ? a.value : b.value);
      if (location) candidates.push({ index: first.index, location });
    }
  } else {
    // An unlabelled pair must occupy its own line/semicolon-delimited segment,
    // optionally introduced by GPS/Location. This excludes speed, voltage,
    // dates, IMEIs, IP addresses and fragments of configuration commands.
    let offset = 0;
    for (const segment of plain.split(/[\r\n;]/)) {
      let value = segment.trim().replace(LOCATION_PREFIX, '').trim();
      if ((value.startsWith('(') && value.endsWith(')')) || (value.startsWith('[') && value.endsWith(']'))) value = value.slice(1, -1).trim();
      const location = parsePair(value, true);
      if (location) candidates.push({ index: offset, location });
      offset += segment.length + 1;
    }
  }

  candidates.sort((a, b) => a.index - b.index);
  return candidates[0]?.location || null;
}

function labeledCoordinate(value: string, axis: Axis): Coordinate | null {
  const match = value.match(LABELED_VALUE);
  if (!match) return null;
  const remainder = value.slice(match[0].length).replace(/^[\s,;|#.]+/, '');
  // Additional numeric pieces immediately after a value are not a decimal fix
  // (for example DMS, malformed coordinates or a second unlabelled value).
  if (/^(?:[+-]?\d|\.\d|[NSEWO]\b)/i.test(remainder)) return null;
  return parseCoordinate(match[0], axis);
}

function parseCoordinate(value: string, axis: Axis): Coordinate | null {
  const match = value.match(COORDINATE);
  if (!match) return null;
  const hemispheres = [match[1], match[3]].filter(Boolean).map(item => item.toUpperCase());
  const allowed = axis === 'latitude' ? ['N', 'S'] : ['E', 'W', 'O'];
  if (hemispheres.some(item => !allowed.includes(item))) return null;
  const directions = hemispheres.map(item => ['S', 'W', 'O'].includes(item) ? -1 : 1);
  if (directions.some(item => item !== directions[0])) return null;
  const raw = match[2];
  let number = Number(raw);
  if (!Number.isFinite(number)) return null;
  if (directions.length) {
    if ((raw.startsWith('-') && directions[0] > 0) || (raw.startsWith('+') && directions[0] < 0)) return null;
    number = Math.abs(number) * directions[0];
  }
  if (Math.abs(number) > (axis === 'latitude' ? 90 : 180)) return null;
  return { value: Object.is(number, -0) ? 0 : number, decimal: raw.includes('.'), hemisphere: directions.length > 0 };
}

function parsePair(value: string, requireDecimals: boolean): SmsLocation | null {
  if (!value || value.length > 160) return null;
  const separators = value.includes(',')
    ? (value.match(/,/g)?.length === 1 ? [value.indexOf(',')] : [])
    : Array.from(value.matchAll(/\s+/g)).map(match => match.index!);
  const results: SmsLocation[] = [];
  for (const split of separators) {
    const a = parseCoordinate(value.slice(0, split), 'latitude');
    const b = parseCoordinate(value.slice(split + 1), 'longitude');
    if (!a || !b || (requireDecimals && (!a.decimal || !b.decimal) && (!a.hemisphere || !b.hemisphere))) continue;
    const location = makeLocation(a.value, b.value);
    if (location) results.push(location);
  }
  const first = results[0];
  return first && results.every(item => item.latitude === first.latitude && item.longitude === first.longitude) ? first : null;
}

function locationFromGoogleUrl(raw: string): SmsLocation | null {
  try {
    const value = raw.replace(/[.;!\])}]+$/, '');
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (host !== 'maps.google.com' && !(['google.com', 'www.google.com'].includes(host) && /^\/maps(?:\/|$)/.test(url.pathname))) return null;
    let result: SmsLocation | null = null;
    for (const key of ['q', 'query', 'll']) {
      const values = url.searchParams.getAll(key);
      // Conflicting duplicate coordinate parameters are ambiguous.
      if (values.length > 1) return null;
      if (!values.length) continue;
      const pair = values[0].trim().replace(/^loc\s*:/i, '').trim();
      const location = parsePair(pair, false);
      if (!location || (result && (result.latitude !== location.latitude || result.longitude !== location.longitude))) return null;
      result = location;
    }
    return result;
  } catch {
    return null;
  }
}

function makeLocation(latitude: number, longitude: number): SmsLocation | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
  return { latitude, longitude, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}` };
}

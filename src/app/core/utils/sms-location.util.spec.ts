import { extractSmsLocation } from './sms-location.util';

describe('extractSmsLocation', () => {
  const location = (latitude: number, longitude: number) => ({ latitude, longitude,
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}` });

  const valid: Array<[string, number, number]> = [
    ['lat:18.4861 lon:-69.9312', 18.4861, -69.9312],
    ['Lat:18.4861 Lon:-69.9312.', 18.4861, -69.9312],
    ['LAT=+18.4861\nLNG=-69.9312', 18.4861, -69.9312],
    ['Latitude:18.4861,Longitude:-69.9312;Speed:0.00', 18.4861, -69.9312],
    ['Longitud = -69.9312\nLatitud = 18.4861', 18.4861, -69.9312],
    ['Longitude: W69.9312 Latitude: N18.4861', 18.4861, -69.9312],
    ['Lat:18.4861N Long:69.9312O', 18.4861, -69.9312],
    ['lat:S18.4861 lon:E69.9312', -18.4861, 69.9312],
    ['lat:-18.4861S lon:-69.9312W', -18.4861, -69.9312],
    ['lat:N+18.4861N lon:W-69.9312O', 18.4861, -69.9312],
    ['Lat:18.4861° N;Lon:69.9312° W', 18.4861, -69.9312],
    ['GPS OK IMEI:863874080932787 Lat:18.4861\nSpeed:0.00\nLon:-69.9312 Battery:12.6V', 18.4861, -69.9312],
    ['18.4861,-69.9312', 18.4861, -69.9312],
    ['18.4861 -69.9312', 18.4861, -69.9312],
    ['N 18.4861 W 69.9312', 18.4861, -69.9312],
    ['18.4861 N 69.9312 O', 18.4861, -69.9312],
    ['GPS: 18.4861,-69.9312', 18.4861, -69.9312],
    ['GPS:18.4861,-69.9312', 18.4861, -69.9312],
    ['Ubicación: 18.4861 -69.9312', 18.4861, -69.9312],
    ['GPS OK\n(18.4861,-69.9312)\nSpeed:0.0', 18.4861, -69.9312],
    ['lat:.5 lon:-.75', 0.5, -0.75],
    ['lat:90 lon:-180', 90, -180],
    ['lat:-90 lon:180', -90, 180],
    ['lat:0 lon:20', 0, 20],
    ['lat:20 lon:0', 20, 0],
    ['lat:-0 lon:20', 0, 20],
    ['lat:18.1 lon:-69.1\nlat:19.2 lon:-70.2', 18.1, -69.1],
    ['http://maps.google.com/maps?q=18.4861,-69.9312', 18.4861, -69.9312],
    ['https://maps.google.com/?q=loc:18.4861,-69.9312&z=16', 18.4861, -69.9312],
    ['https://www.google.com/maps/search/?api=1&query=18.4861%2C-69.9312', 18.4861, -69.9312],
    ['https://google.com/maps?ll=18.4861,-69.9312', 18.4861, -69.9312],
    ['https://google.com/maps?q=18.4861,-69.9312&ll=18.4861,-69.9312', 18.4861, -69.9312],
    ['maps.google.com/?q=18.4861,-69.9312', 18.4861, -69.9312],
    ['GPS: https://maps.google.com/?q=18.4861,-69.9312.', 18.4861, -69.9312],
    ['https://www.google.com/maps?q=90,180', 90, 180],
    ['https://maps.google.com/?q=18.1,-69.1\nLat:19.2 Lon:-70.2', 18.1, -69.1],
  ];
  for (const [text, latitude, longitude] of valid) {
    it(`extracts ${JSON.stringify(text)}`, () => expect(extractSmsLocation(text)).toEqual(location(latitude, longitude)));
  }

  const invalid: unknown[] = [
    null, undefined, {}, [], 18.48, '', 'GPS OK', 'WHERE#', 'SIM:8910300000019069688',
    '18,69', '12.6V 40.5km/h', 'Voltaje:12.6,Velocidad:40.5', 'speed:18.48,-69.93',
    'IMEI:863874080932787, SIM:8910300000019069688', '2026-09-29 12:30:45', '2026.09,29.12',
    'SERVER,0,167.71.121.6,5023,0#', '192.168.18.48,69.93', 'lat:18.48.1 lon:-69.93',
    'lat:18.48 lon:-69.93.4', 'lat:18.48 lon:-69.93. 4',
    'lat:91 lon:-69.93 18.48 20.30', 'lat:18.48 lon:181', 'lat:-90.1 lon:-70.2',
    'lat:0 lon:0', '0.0,-0.0', 'lat:NaN lon:-69.93', 'lat:Infinity lon:20.3',
    'lat:18e2 lon:-69.93', 'lat:18.5 30.4 lon:-69.9', 'lat:18°30\' lon:69°20\'',
    'lat:-18.48N lon:69.93W', 'lat:+18.48S lon:69.93E', 'lat:18.48E lon:69.93W',
    'lat:N18.48S lon:69.93W', 'lat:18.48N lon:W69.93E', 'lat:18.48N lon:+69.93O',
    'lat:18.48 lat:19.2 lon:-69.93', 'Latitude missing\n12.6 40.5', 'lat:18.48',
    '18.48,-69.93,20.4', '18.48 -69.93 20.4', 'latitudeInvalid:18.48 longitudeInvalid:-69.93',
    'https://evil.example/?q=18.48,-69.93', 'https://maps.google.com.evil.example/?q=18.48,-69.93',
    'evil.maps.google.com/?q=18.48,-69.93', 'evilgoogle.com/maps?q=18.48,-69.93',
    'https://maps.google.com@evil.example/?q=18.48,-69.93', 'https://evil@maps.google.com/?q=18.48,-69.93',
    'javascript:18.48,-69.93', 'data:text/html,18.48,-69.93', 'ftp://maps.google.com/?q=18.48,-69.93',
    'https://maps.google.com:8080/?q=18.48,-69.93', 'https://google.com/redirect?q=18.48,-69.93',
    'https://maps.google.com/?q=18.48,-69.93&q=19.0,-70.0', 'https://maps.google.com/?q=91.0,-69.93',
    'https://maps.google.com/?q=18.48,-69.93&ll=19.0,-70.0',
    'https://maps.google.com/?q=91.0,-69.93&query=18.48,-69.93',
    'https://maps.google.com/?q=0,0', 'https://maps.app.goo.gl/example', 'https://maps.google.com/?q=18.48,-69.93evil',
  ];
  for (const text of invalid) {
    it(`rejects ${JSON.stringify(text)}`, () => expect(extractSmsLocation(text)).toBeNull());
  }

  it('returns only canonical Google Maps URLs and leaves the original SMS unchanged', () => {
    const text = 'Lat:18.4861 Lon:-69.9312 <img src=x onerror=alert(1)>';
    const original = text;
    const result = extractSmsLocation(text);
    expect(text).toBe(original);
    expect(result).toEqual(location(18.4861, -69.9312));
    expect(result?.url).not.toContain('<');
    expect(result?.url).not.toContain('onerror');
  });
});

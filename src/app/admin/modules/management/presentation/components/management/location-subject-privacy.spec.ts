import {
  isEmployeeLocationSubjectValue,
  sanitizeManagementLocationSubject,
} from './location-subject-privacy';

describe('Management location subject privacy', () => {
  const privateLocation = {
    latitude: 18.48,
    longitude: -69.93,
    locationUpdatedAt: '2026-07-24T12:00:00.000Z',
    realtime_location: {
      latitude: 18.48,
      longitude: -69.93,
      recordedAt: '2026-07-24T12:00:00.000Z',
    },
    static_location_url: 'https://maps.example/private',
    static_location_address: 'Dirección privada',
    static_latitude: 18.47,
    static_longitude: -69.92,
    latest_location: { latitude: 18.48, longitude: -69.93 },
  };

  for (const affiliation_type_id of ['empleado', 'tecnico_empleado']) {
    it(`keeps map data for employee subject ${affiliation_type_id}`, () => {
      const subject = { affiliation_type_id, ...privateLocation };
      expect(isEmployeeLocationSubjectValue(subject)).toBe(true);
      expect(sanitizeManagementLocationSubject(subject)).toEqual(subject);
    });
  }

  for (const affiliation_type_id of [
    'cliente',
    'subcliente',
    'socio',
    'tecnico_independiente',
    'otro',
  ]) {
    it(`removes map data for non-employee subject ${affiliation_type_id}`, () => {
      const sanitized: any = sanitizeManagementLocationSubject({
        affiliation_type_id,
        name: 'Visible',
        ...privateLocation,
      });

      expect(sanitized.name).toBe('Visible');
      expect(sanitized.latitude).toBeUndefined();
      expect(sanitized.longitude).toBeUndefined();
      expect(sanitized.locationUpdatedAt).toBeUndefined();
      expect(sanitized.realtime_location).toBeUndefined();
      expect(sanitized.static_location_url).toBeUndefined();
      expect(sanitized.static_location_address).toBeUndefined();
      expect(sanitized.static_latitude).toBeUndefined();
      expect(sanitized.static_longitude).toBeUndefined();
      expect(sanitized.latest_location).toBeUndefined();
    });
  }
});

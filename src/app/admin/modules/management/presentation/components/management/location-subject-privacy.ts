const EMPLOYEE_LOCATION_AFFILIATIONS = new Set([
  'empleado',
  'tecnico_empleado',
]);

const MANAGEMENT_LOCATION_FIELDS = [
  'latitude',
  'longitude',
  'locationAccuracy',
  'locationUpdatedAt',
  'realtime_location',
  'static_location_url',
  'static_location_address',
  'static_latitude',
  'static_longitude',
  'last_location_at',
  'lastLocationAt',
  'latest_location',
  'last_location',
  'location',
] as const;

export function isEmployeeLocationSubjectValue(user: any): boolean {
  const settings = Array.isArray(user?.settings)
    ? user.settings[0]
    : user?.settings;
  const affiliation = String(
    user?.affiliation_type_id ||
    user?.affiliation_type ||
    settings?.affiliation_type ||
    '',
  ).trim().toLowerCase();

  return EMPLOYEE_LOCATION_AFFILIATIONS.has(affiliation);
}

export function sanitizeManagementLocationSubject<T>(user: T): T {
  if (!user || isEmployeeLocationSubjectValue(user)) {
    return user;
  }

  const sanitized: any = { ...(user as any) };
  MANAGEMENT_LOCATION_FIELDS.forEach(field => delete sanitized[field]);
  return sanitized as T;
}

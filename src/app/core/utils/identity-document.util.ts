export type IdentityDocumentType = 'cedula' | 'pasaporte';

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getIdentityDocumentType(data: any): IdentityDocumentType | null {
  const type = clean(data?.tipo_documento).toLocaleLowerCase('es-DO');
  if (type === 'cedula' || type === 'cédula') return 'cedula';
  if (type === 'pasaporte' || type === 'passport') return 'pasaporte';
  if (data?.es_pasaporte === true) return 'pasaporte';
  if (data?.es_cedula === true) return 'cedula';
  return null;
}

export function getIdentityDocumentNumber(data: any): string {
  const type = getIdentityDocumentType(data);
  if (type === 'pasaporte') return clean(data?.numero_documento) || clean(data?.pasaporte);
  if (type === 'cedula') return clean(data?.numero_documento) || clean(data?.cedula);
  return clean(data?.numero_documento) || clean(data?.cedula) || clean(data?.pasaporte);
}

export function isValidIdentityDocument(data: any): boolean {
  const type = getIdentityDocumentType(data);
  return Boolean(
    type &&
    getIdentityDocumentNumber(data) &&
    (data?.es_documento_identidad === true || data?.es_cedula === true || data?.es_pasaporte === true)
  );
}

export function getIdentityDocumentLabel(data: any): string {
  return getIdentityDocumentType(data) === 'pasaporte' ? 'Pasaporte' : 'Cédula';
}

export function hasCompleteIdentityData(data: any): boolean {
  const names = clean(data?.nombres);
  const lastNames = clean(data?.apellidos);
  const number = getIdentityDocumentNumber(data).replace(/\s/g, '');
  const minimumLength = getIdentityDocumentType(data) === 'pasaporte' ? 5 : 9;
  return isValidIdentityDocument(data) && Boolean(names && lastNames && number.length >= minimumLength);
}

import {
  getIdentityDocumentLabel,
  getIdentityDocumentNumber,
  hasCompleteIdentityData,
  isValidIdentityDocument,
} from './identity-document.util';

describe('identity document utilities', () => {
  it('accepts legacy cedula payloads', () => {
    const data = { es_cedula: true, cedula: '00112345678', nombres: 'Ana', apellidos: 'Pérez' };
    expect(isValidIdentityDocument(data)).toBeTrue();
    expect(hasCompleteIdentityData(data)).toBeTrue();
    expect(getIdentityDocumentLabel(data)).toBe('Cédula');
  });

  it('accepts passports and preserves alphanumeric numbers', () => {
    const data = {
      es_documento_identidad: true,
      tipo_documento: 'pasaporte',
      numero_documento: 'A78644867',
      nombres: 'Hantz',
      apellidos: 'Lorimerus',
    };
    expect(isValidIdentityDocument(data)).toBeTrue();
    expect(hasCompleteIdentityData(data)).toBeTrue();
    expect(getIdentityDocumentNumber(data)).toBe('A78644867');
    expect(getIdentityDocumentLabel(data)).toBe('Pasaporte');
  });
});

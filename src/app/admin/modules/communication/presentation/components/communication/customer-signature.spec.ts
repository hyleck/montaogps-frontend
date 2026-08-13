import { buildCustomerSignatureLabel } from './customer-signature';

describe('buildCustomerSignatureLabel', () => {
  it('shows the registered customer first name, affiliation and profile', () => {
    expect(buildCustomerSignatureLabel({
      _id: 'customer-id',
      name: 'Pedro Martínez',
      affiliation_type_id: 'cliente',
      profile_type_id: 'personal',
    })).toBe('Pedro - Cliente/Personal');
  });

  it('formats known technical and company identifiers', () => {
    expect(buildCustomerSignatureLabel({
      _id: 'employee-id',
      name: 'Ana María',
      affiliation_type_id: 'tecnico_empleado',
      profile_type_id: 'empresa',
    })).toBe('Ana - Técnico empleado/Empresa');
  });

  it('identifies a WhatsApp contact without inventing a registered profile', () => {
    expect(
      buildCustomerSignatureLabel(null, 'Samuel Roberts'),
    ).toBe('Samuel - Contacto/WhatsApp');
  });
});

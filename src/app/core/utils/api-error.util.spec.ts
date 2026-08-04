import { getApiErrorMessage } from './api-error.util';

describe('getApiErrorMessage', () => {
  it('uses the concrete backend message and request reference', () => {
    expect(getApiErrorMessage({
      status: 409,
      error: {
        message: 'El correo ya está registrado.',
        requestId: 'req-123',
      },
    }, 'No se pudo registrar el usuario')).toBe(
      'El correo ya está registrado. (referencia: req-123)',
    );
  });

  it('explains a connection failure instead of returning an ambiguous error', () => {
    expect(getApiErrorMessage({ status: 0 }, 'No se pudo guardar')).toContain(
      'no fue posible conectar con el servidor',
    );
  });

  it('includes the HTTP status when an old backend sends no detail', () => {
    expect(getApiErrorMessage({
      status: 500,
      error: { message: 'Internal server error' },
    }, 'No se pudo guardar')).toContain('HTTP 500');
  });
});

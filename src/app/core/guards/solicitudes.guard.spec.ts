import { SolicitudesGuard } from './solicitudes.guard';

describe('SolicitudesGuard', () => {
  function createGuard(user: any) {
    const authService = {
      getCurrentUser: jasmine.createSpy().and.returnValue(user),
    };
    const router = {
      navigate: jasmine.createSpy().and.resolveTo(true),
    };
    return {
      guard: new SolicitudesGuard(authService as any, router as any),
      router,
    };
  }

  it('allows administrative employees', () => {
    const { guard, router } = createGuard({ affiliation_type_id: 'empleado' });

    expect(guard.canActivate()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('allows root support users', () => {
    const { guard } = createGuard({ root: true, affiliation_type_id: 'cliente' });

    expect(guard.canMatch()).toBeTrue();
  });

  it('redirects technicians and clients away from the administrative module', () => {
    const { guard, router } = createGuard({ affiliation_type_id: 'tecnico' });

    expect(guard.canActivate()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/admin/dashboard']);
  });
});

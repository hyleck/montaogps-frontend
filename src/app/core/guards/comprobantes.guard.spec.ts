import { ComprobantesGuard } from './comprobantes.guard';

describe('ComprobantesGuard', () => {
  function setup(user: any) {
    const authService = {
      getCurrentUser: jasmine.createSpy().and.returnValue(user),
    };
    const router = {
      navigate: jasmine.createSpy().and.resolveTo(true),
    };
    return {
      guard: new ComprobantesGuard(authService as any, router as any),
      router,
    };
  }

  it('allows employees to enter the receipt module', () => {
    const { guard, router } = setup({ affiliation_type_id: 'empleado' });

    expect(guard.canActivate()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('allows root and developer support users', () => {
    expect(setup({ root: true }).guard.canMatch()).toBeTrue();
    expect(setup({ developer: 'true' }).guard.canActivate()).toBeTrue();
  });

  it('redirects technicians and clients', () => {
    for (const user of [
      { affiliation_type_id: 'tecnico' },
      { affiliation_type_id: 'cliente' },
    ]) {
      const { guard, router } = setup(user);
      expect(guard.canActivate()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledOnceWith(['/admin/dashboard']);
    }
  });
});

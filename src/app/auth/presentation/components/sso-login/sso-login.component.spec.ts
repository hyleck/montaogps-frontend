import { of, throwError } from 'rxjs';
import { SsoLoginComponent } from './sso-login.component';

describe('SsoLoginComponent', () => {
  function setup(code: string | null, response: any = {
    access_token: 'gps-token',
    user: { id: 'gps-user-id' }
  }) {
    const route = {
      snapshot: {
        queryParamMap: {
          get: jasmine.createSpy().and.callFake((key: string) => key === 'code' ? code : null)
        }
      }
    };
    const router = { navigate: jasmine.createSpy().and.resolveTo(true) };
    const authService = {
      clearSessionForSso: jasmine.createSpy(),
      exchangeIndexAuthorizationCode: jasmine.createSpy().and.returnValue(of(response))
    };
    const component = new SsoLoginComponent(
      route as any,
      router as any,
      authService as any
    );

    return { component, router, authService };
  }

  it('exchanges only the one-use authorization code and replaces the callback URL', () => {
    const { component, router, authService } = setup(
      'valid-one-time-authorization-code'
    );

    component.ngOnInit();

    expect(authService.clearSessionForSso).toHaveBeenCalled();
    expect(authService.exchangeIndexAuthorizationCode).toHaveBeenCalledOnceWith(
      'valid-one-time-authorization-code'
    );
    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin/management', 'u', 'gps-user-id'],
      { replaceUrl: true }
    );
  });

  it('does not call the backend without an authorization code', () => {
    const { component, authService } = setup(null);

    component.ngOnInit();

    expect(authService.exchangeIndexAuthorizationCode).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('autorización válida');
  });

  it('shows a safe error when the authorization cannot be exchanged', () => {
    const { component, authService } = setup('expired-authorization-code');
    authService.exchangeIndexAuthorizationCode.and.returnValue(
      throwError(() => new Error('expired'))
    );

    component.ngOnInit();

    expect(component.errorMessage).toContain('Vuelve a abrir Montao GPS desde Index');
  });
});

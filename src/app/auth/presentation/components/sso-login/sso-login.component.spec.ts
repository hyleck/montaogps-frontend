import { discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MIN_SKELETON_MS, SsoLoginComponent } from './sso-login.component';

describe('SsoLoginComponent', () => {
  function setup(code: string | null, response: any = {
    access_token: 'gps-token',
    user: { id: 'gps-user-id' }
  }, preview: string | null = null) {
    const route = {
      snapshot: {
        queryParamMap: {
          get: jasmine.createSpy().and.callFake((key: string) => {
            if (key === 'code') return code;
            if (key === 'preview') return preview;
            return null;
          })
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

  it('exchanges only the one-use authorization code and replaces the callback URL', fakeAsync(() => {
    const { component, router, authService } = setup(
      'valid-one-time-authorization-code'
    );

    component.ngOnInit();
    flush();

    expect(authService.clearSessionForSso).toHaveBeenCalled();
    expect(authService.exchangeIndexAuthorizationCode).toHaveBeenCalledOnceWith(
      'valid-one-time-authorization-code'
    );
    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin/management', 'u', 'gps-user-id'],
      { replaceUrl: true }
    );
  }));

  it('keeps the skeleton visible for the minimum time even when Index answers at once', fakeAsync(() => {
    const { component, router } = setup('valid-one-time-authorization-code');

    component.ngOnInit();
    tick(MIN_SKELETON_MS - 1);
    expect(router.navigate).not.toHaveBeenCalled();

    tick(1);
    expect(router.navigate).toHaveBeenCalledTimes(1);
  }));

  it('advances the status steps while the access is prepared', fakeAsync(() => {
    const { component } = setup('valid-one-time-authorization-code');

    component.ngOnInit();
    expect(component.steps[component.step()]).toBe('Conectando con Montao Index');

    tick(700);
    expect(component.steps[component.step()]).toBe('Preparando tu flota');

    tick(700);
    expect(component.steps[component.step()]).toBe('Abriendo Gestión');
    flush();
  }));

  it('does not call the backend without an authorization code', fakeAsync(() => {
    const { component, authService, router } = setup(null);

    component.ngOnInit();
    flush();

    expect(authService.exchangeIndexAuthorizationCode).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('autorización válida');
  }));

  it('shows a safe error when the authorization cannot be exchanged', fakeAsync(() => {
    const { component, authService, router } = setup('expired-authorization-code');
    authService.exchangeIndexAuthorizationCode.and.returnValue(
      throwError(() => new Error('expired'))
    );

    component.ngOnInit();
    flush();

    expect(component.errorMessage).toContain('Vuelve a abrir Montao GPS desde Index');
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('previews the skeleton in development without touching the session or exchanging codes', fakeAsync(() => {
    const { component, authService, router } = setup('some-code', undefined, '1');

    component.ngOnInit();
    tick(MIN_SKELETON_MS * 2);

    expect(authService.clearSessionForSso).not.toHaveBeenCalled();
    expect(authService.exchangeIndexAuthorizationCode).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('');
    discardPeriodicTasks();
  }));

  it('stops pending timers when leaving the page', fakeAsync(() => {
    const { component, router } = setup('valid-one-time-authorization-code');

    component.ngOnInit();
    component.ngOnDestroy();
    tick(MIN_SKELETON_MS * 2);

    expect(component.step()).toBe(0);
    expect(router.navigate).not.toHaveBeenCalled();
  }));
});

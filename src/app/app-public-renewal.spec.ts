import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { NavigationCancel, NavigationEnd, NavigationStart } from '@angular/router';
import { of, Subject } from 'rxjs';
import { environment } from '../environments/environment';
import { AppComponent } from './app.component';
import { PublicRegistrationNotification } from './core/services/firebase-notifications.service';

describe('AppComponent public renewal isolation', () => {
  let component: AppComponent;
  let auth: jasmine.SpyObj<any>;
  let router: { url: string; events: Subject<any>; navigate: jasmine.Spy };
  let firebase: { publicRegistrationCompleted$: Subject<PublicRegistrationNotification>; subscribeLoggedUserToTopic: jasmine.Spy };
  let http: jasmine.SpyObj<any>;
  let communication: jasmine.SpyObj<any>;
  let activity: jasmine.SpyObj<any>;
  let overlays: jasmine.SpyObj<any>;
  let monitoring: jasmine.SpyObj<any>;
  let consoleLogs: jasmine.SpyObj<any>;
  let backgroundServices: jasmine.SpyObj<any>[];
  let originalSessionDate: string | null;
  let originalAuthToken: string | null;
  let initialized = false;

  beforeEach(() => {
    originalSessionDate = localStorage.getItem('session_date');
    originalAuthToken = localStorage.getItem('authtoken');
    localStorage.setItem('session_date', '2026-09-29T18:00:00Z');
    localStorage.setItem('authtoken', 'saved-session-for-test');
    auth = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'getCurrentUser', 'isSupportImpersonating', 'logout']);
    auth.isAuthenticated.and.returnValue(true);
    auth.getCurrentUser.and.returnValue({ id: 'saved-user' });
    auth.isSupportImpersonating.and.returnValue(false);
    router = { url: '/admin/management', events: new Subject<any>(), navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    firebase = {
      publicRegistrationCompleted$: new Subject<PublicRegistrationNotification>(),
      subscribeLoggedUserToTopic: jasmine.createSpy('subscribeLoggedUserToTopic').and.resolveTo(undefined),
    };
    http = jasmine.createSpyObj('HttpClient', ['get']);
    http.get.and.returnValue(of({ valid: true }));
    communication = jasmine.createSpyObj('communication', ['start', 'stop']);
    activity = jasmine.createSpyObj('activity', ['start', 'stop']);
    overlays = jasmine.createSpyObj('overlays', ['start', 'cleanupNow']);
    monitoring = jasmine.createSpyObj('monitoring', ['start', 'stop']);
    consoleLogs = jasmine.createSpyObj('consoleLogs', ['start', 'stop']);
    backgroundServices = [communication, activity, monitoring, consoleLogs];
    component = new AppComponent({} as any, auth, router as any, firebase as any, http, communication, activity, overlays, monitoring, consoleLogs);
  });

  afterEach(() => {
    destroy();
    if (originalSessionDate === null) localStorage.removeItem('session_date');
    else localStorage.setItem('session_date', originalSessionDate);
    if (originalAuthToken === null) localStorage.removeItem('authtoken');
    else localStorage.setItem('authtoken', originalAuthToken);
  });

  function destroy(): void {
    if (!initialized) return;
    component.ngOnDestroy();
    initialized = false;
  }

  function withApp(url: string, scenario: () => void): void {
    router.url = url;
    component.ngOnInit();
    initialized = true;
    try {
      scenario();
    } finally {
      destroy();
      flushMicrotasks();
    }
  }

  it('starts a public renewal page without private services or authentication checks despite a saved session', fakeAsync(() => {
    withApp('/renovar/public-token', () => {
      tick(30000);
      window.dispatchEvent(new StorageEvent('storage', { key: 'authtoken', newValue: 'another-session' }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'user', newValue: '{}' }));
      flushMicrotasks();
      for (const service of backgroundServices) expect(service.start).not.toHaveBeenCalled();
      expect(auth.isAuthenticated).not.toHaveBeenCalled();
      expect(auth.getCurrentUser).not.toHaveBeenCalled();
      expect(auth.isSupportImpersonating).not.toHaveBeenCalled();
      expect(firebase.subscribeLoggedUserToTopic).not.toHaveBeenCalled();
      expect(http.get).not.toHaveBeenCalled();
      expect(auth.logout).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(localStorage.getItem('authtoken')).toBe('saved-session-for-test');
      expect(overlays.start).toHaveBeenCalledTimes(1);
    });
  }));

  it('recognizes a direct public URL before the router has completed its initial navigation', fakeAsync(() => {
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, '', '/renovar/direct-public-token');
    try {
      withApp('/', () => {
        tick(10000);
        expect(auth.isAuthenticated).not.toHaveBeenCalled();
        expect(http.get).not.toHaveBeenCalled();
        for (const service of backgroundServices) expect(service.start).not.toHaveBeenCalled();
      });
    } finally {
      window.history.replaceState({}, '', originalUrl);
    }
  }));

  it('ignores private registration notifications on the public renewal page', fakeAsync(() => {
    withApp('/renovar/public-token', () => {
      firebase.publicRegistrationCompleted$.next({ clientName: 'PRIVATE CLIENT', credentialsEmail: 'private@example.test', credentialsPassword: 'private-test-value' });
      expect(component.registrationNotificationVisible).toBeFalse();
      expect(component.registrationNotification).toBeNull();
      tick(5000);
      expect(firebase.subscribeLoggedUserToTopic).not.toHaveBeenCalled();
    });
  }));

  it('stops services, hides private data and cancels in-flight verification at navigation start', fakeAsync(() => {
    const verification = new Subject<{ valid: boolean }>();
    http.get.and.returnValue(verification);
    withApp('/admin/management', () => {
      for (const service of backgroundServices) expect(service.start).toHaveBeenCalledTimes(1);
      firebase.publicRegistrationCompleted$.next({ clientName: 'Private Client', credentialsEmail: 'private@example.test' });
      expect(component.registrationNotificationVisible).toBeTrue();
      tick(10000);
      expect(verification.observed).toBeTrue();
      router.events.next(new NavigationStart(1, '/renovar/public-token'));
      expect(verification.observed).toBeFalse();
      for (const service of backgroundServices) expect(service.stop).toHaveBeenCalledTimes(1);
      expect(component.registrationNotification).toBeNull();
      expect(component.registrationNotificationVisible).toBeFalse();
      verification.next({ valid: false });
      expect(auth.logout).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      auth.isAuthenticated.calls.reset();
      auth.getCurrentUser.calls.reset();
      http.get.calls.reset();
      router.url = '/renovar/public-token';
      router.events.next(new NavigationEnd(1, router.url, router.url));
      tick(30000);
      for (const service of backgroundServices) expect(service.stop).toHaveBeenCalledTimes(1);
      expect(auth.isAuthenticated).not.toHaveBeenCalled();
      expect(auth.getCurrentUser).not.toHaveBeenCalled();
      expect(http.get).not.toHaveBeenCalled();
      firebase.publicRegistrationCompleted$.next({ clientName: 'Another Private Client' });
      expect(component.registrationNotification).toBeNull();
    });
  }));

  it('resumes normal background services and verification after returning to the admin area', fakeAsync(() => {
    withApp('/renovar/public-token', () => {
      router.events.next(new NavigationStart(2, '/admin/management'));
      for (const service of backgroundServices) expect(service.start).not.toHaveBeenCalled();
      router.url = '/admin/management';
      router.events.next(new NavigationEnd(2, router.url, router.url));
      for (const service of backgroundServices) expect(service.start).toHaveBeenCalledTimes(1);
      firebase.publicRegistrationCompleted$.next({ clientName: 'New Client' });
      expect(component.registrationNotificationVisible).toBeTrue();
      tick(10000);
      expect(auth.isAuthenticated).toHaveBeenCalled();
      expect(firebase.subscribeLoggedUserToTopic).toHaveBeenCalled();
      expect(http.get).toHaveBeenCalledWith(`${environment.apiUrl}/users/saved-user/verify-session?session_date=2026-09-29T18:00:00Z`);
      expect(auth.logout).not.toHaveBeenCalled();
    });
  }));

  it('continues verifying normal sessions and redirects when their server verification fails', fakeAsync(() => {
    http.get.and.returnValues(of({ valid: true }), of({ valid: false }));
    withApp('/admin/management', () => {
      tick(10000);
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(auth.logout).not.toHaveBeenCalled();
      tick(10000);
      expect(http.get).toHaveBeenCalledTimes(2);
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledOnceWith(['/auth/login']);
    });
  }));

  it('preserves the support impersonation exception in the admin area', fakeAsync(() => {
    auth.isSupportImpersonating.and.returnValue(true);
    withApp('/admin/management', () => {
      tick(10000);
      expect(auth.getCurrentUser).toHaveBeenCalled();
      expect(http.get).not.toHaveBeenCalled();
      expect(auth.logout).not.toHaveBeenCalled();
    });
  }));

  it('restores normal services when navigation to the public page is cancelled', fakeAsync(() => {
    withApp('/admin/management', () => {
      router.events.next(new NavigationStart(3, '/renovar/public-token'));
      for (const service of backgroundServices) expect(service.stop).toHaveBeenCalledTimes(1);
      router.events.next(new NavigationCancel(3, '/renovar/public-token', 'Navigation cancelled'));
      for (const service of backgroundServices) expect(service.start).toHaveBeenCalledTimes(2);
      tick(10000);
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  }));

  it('cleans up interval, storage, router and verification subscriptions on destruction', fakeAsync(() => {
    const verification = new Subject<{ valid: boolean }>();
    http.get.and.returnValue(verification);
    withApp('/admin/management', () => {
      tick(10000);
      expect(verification.observed).toBeTrue();
      destroy();
      expect(verification.observed).toBeFalse();
      expect(router.events.observed).toBeFalse();
      expect(firebase.publicRegistrationCompleted$.observed).toBeFalse();
      auth.isAuthenticated.calls.reset();
      http.get.calls.reset();
      window.dispatchEvent(new StorageEvent('storage', { key: 'user', newValue: '{}' }));
      router.events.next(new NavigationEnd(4, '/admin/management', '/admin/management'));
      verification.next({ valid: false });
      tick(30000);
      expect(auth.isAuthenticated).not.toHaveBeenCalled();
      expect(http.get).not.toHaveBeenCalled();
      expect(auth.logout).not.toHaveBeenCalled();
      expect(overlays.cleanupNow).toHaveBeenCalledTimes(1);
    });
  }));
});

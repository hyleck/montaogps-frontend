import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { RenewalLinksService } from './renewal-links.service';

describe('RenewalLinksService', () => {
  let service: RenewalLinksService;
  let http: HttpTestingController;
  const adminUrl = `${environment.apiUrl}/process/renewal-links`;
  const publicUrl = `${environment.apiUrl}/public/renewals/token`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([(req, next) => next(req.clone({ setHeaders: { Authorization: 'Bearer existing-gps-session' } }))])),
      provideHttpClientTesting(),
    ] });
    service = TestBed.inject(RenewalLinksService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('authenticates creation and only sends the chosen client', () => {
    service.create('client-1').subscribe();
    const request = http.expectOne(adminUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer existing-gps-session');
    expect(request.request.body).toEqual({ clientId: 'client-1' });
    request.flush({});
  });

  it('scopes response history to the selected client and revokes the chosen link', () => {
    service.getForClient('client-1').subscribe();
    const history = http.expectOne(`${adminUrl}?clientId=client-1`);
    expect(history.request.method).toBe('GET');
    history.flush([]);
    service.revoke('link-1').subscribe();
    const revoke = http.expectOne(`${adminUrl}/link-1/revoke`);
    expect(revoke.request.method).toBe('PATCH');
    expect(revoke.request.headers.has('Authorization')).toBeTrue();
    revoke.flush({});
  });

  it('loads and submits public decisions independently of the stored GPS session', () => {
    service.getPublic('token').subscribe();
    const load = http.expectOne(publicUrl);
    expect(load.request.headers.has('Authorization')).toBeFalse();
    load.flush({});
    service.submitPublic('token', [{ deviceId: 'device-1', renew: false }]).subscribe();
    const submit = http.expectOne(publicUrl);
    expect(submit.request.method).toBe('POST');
    expect(submit.request.headers.has('Authorization')).toBeFalse();
    expect(submit.request.body).toEqual({ decisions: [{ deviceId: 'device-1', renew: false }] });
    submit.flush({});
  });

  it('passes expired-link errors to the public page without the auth interceptor', () => {
    let status = 0;
    service.getPublic('expired/token').subscribe({ error: error => status = error.status });
    http.expectOne(`${environment.apiUrl}/public/renewals/expired%2Ftoken`).flush({ message: 'Vencido' }, { status: 410, statusText: 'Gone' });
    expect(status).toBe(410);
  });
});

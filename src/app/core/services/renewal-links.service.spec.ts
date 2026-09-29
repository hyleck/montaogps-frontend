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

  it('sends the chosen expiration range without changing calendar dates or sending empty bounds', () => {
    service.create('client-1', { dateFrom: '2026-09-01', dateTo: '2026-09-30' }).subscribe();
    const bounded = http.expectOne(adminUrl);
    expect(bounded.request.body).toEqual({ clientId: 'client-1', dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    bounded.flush({});
    service.create('client-1', { dateTo: '2026-09-30' }).subscribe();
    const openEnded = http.expectOne(adminUrl);
    expect(openEnded.request.body).toEqual({ clientId: 'client-1', dateTo: '2026-09-30' });
    openEnded.flush({});
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

  it('executes only the saved response with authenticated action, years and registration date', () => {
    const body = { action: 'renewal' as const, years: 1, registrationDate: '2026-09-29' };
    service.execute('response/id', body).subscribe();
    const request = http.expectOne(`${adminUrl}/response%2Fid/execute`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer existing-gps-session');
    expect(request.request.body).toEqual(body);
    expect(request.request.body.deviceIds).toBeUndefined();
    request.flush({});
  });

  it('requests an authenticated preview for the saved response with the exact execution options', () => {
    const body = { action: 'pre_renewal' as const, years: 3, registrationDate: '2026-09-29', expirationDate: '2029-02-28', notes: 'Confirmado' };
    let result: unknown;
    service.preview('response/id', body).subscribe(preview => result = preview);
    const request = http.expectOne(`${adminUrl}/response%2Fid/preview`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer existing-gps-session');
    expect(request.request.body).toEqual(body);
    expect(request.request.body.deviceIds).toBeUndefined();
    const preview = { items: [{
      deviceId: 'device-1', renew: true, canExecute: true, effect: 'pre_renewal',
      currentExpirationDate: '2024-02-29T00:00:00.000Z', expirationDate: '2024-02-29T00:00:00.000Z', requestedExpirationDate: '2029-02-28',
    }] };
    request.flush(preview);
    expect(result).toEqual(preview);
    http.expectNone(`${adminUrl}/response%2Fid/execute`);
  });

  it('passes preview errors to the caller without starting an execution', () => {
    let message = '';
    service.preview('response-1', { action: 'renewal', years: 1, registrationDate: '2026-09-29' })
      .subscribe({ error: error => message = error.error.message });
    const request = http.expectOne(`${adminUrl}/response-1/preview`);
    expect(request.request.body.expirationDate).toBeUndefined();
    request.flush({ message: 'La respuesta ya no está disponible.' }, { status: 409, statusText: 'Conflict' });
    expect(message).toBe('La respuesta ya no está disponible.');
    http.expectNone(`${adminUrl}/response-1/execute`);
  });

  it('preserves optional common expiration and notes and exposes retry conflicts to the dialog', () => {
    const body = { action: 'pre_renewal' as const, years: 2, registrationDate: '2026-09-29', expirationDate: '2028-10-01', notes: 'Confirmado' };
    let status = 0;
    service.execute('response-1', body).subscribe({ error: error => status = error.status });
    const request = http.expectOne(`${adminUrl}/response-1/execute`);
    expect(request.request.body).toEqual(body);
    request.flush({ message: 'Acción fijada.' }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
  });
});

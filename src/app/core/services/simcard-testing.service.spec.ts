import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { SimcardTestingService } from './simcard-testing.service';

describe('SimcardTestingService', () => {
  let service: SimcardTestingService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/sim-card/testing/sim-1`;
  const sessionsUrl = `${environment.apiUrl}/sim-card/testing-sessions`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SimcardTestingService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('starts a temporary session using only SIM and inventory GPS identities', () => {
    service.startSession('sim-1', 'gps-1').subscribe();
    const request = http.expectOne(sessionsUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ simId: 'sim-1', inventoryId: 'gps-1' });
    request.flush({ sessionId: 'test-1', status: 'active' });
  });

  it('recovers the current session and reads its state', () => {
    service.getActiveSession().subscribe();
    const active = http.expectOne(`${sessionsUrl}/active`);
    expect(active.request.method).toBe('GET');
    active.flush(null);
    service.getSession('test-1').subscribe();
    const status = http.expectOne(`${sessionsUrl}/test-1`);
    expect(status.request.method).toBe('GET');
    status.flush({ status: 'active' });
  });

  it('renews and finishes the same backend session', () => {
    service.heartbeat('test-1').subscribe();
    const heartbeat = http.expectOne(`${sessionsUrl}/test-1/heartbeat`);
    expect(heartbeat.request.method).toBe('PATCH');
    expect(heartbeat.request.body).toEqual({});
    heartbeat.flush({ status: 'active' });
    service.finishSession('test-1').subscribe();
    const finish = http.expectOne(`${sessionsUrl}/test-1`);
    expect(finish.request.method).toBe('DELETE');
    finish.flush({ status: 'finished' });
  });

  it('loads commands from the session without allowing a different model or server', () => {
    service.getContext('sim-1', 'test-1').subscribe();
    const request = http.expectOne(req => req.url === url);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual(['sessionId']);
    expect(request.request.params.get('sessionId')).toBe('test-1');
    request.flush({ commands: [] });
  });

  it('sends the command index and session, leaving destination and content to the backend', () => {
    service.sendCommand('sim-1', 3, 'test-1').subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ sessionId: 'test-1', commandIndex: 3 });
    request.flush({ success: true });
  });

  it('scopes history to the session, preserves direction and sorts by timestamp', () => {
    let result: any[] = [];
    service.getMessages('sim-1', 'test-1').subscribe(messages => result = messages);
    const request = http.expectOne(req => req.url === `${url}/messages`);
    expect(request.request.params.get('sessionId')).toBe('test-1');
    request.flush({ messages: [
      { text: 'GPS reply', fecha: '2026-09-29T14:02:00Z', createdby: 'device', type: 'MT' },
      { body: 'WHERE#', timestamp: '2026-09-29T14:01:00Z', type: 'MT', delivered: true },
      { text: 'bad timestamp', fecha: 'invalid' },
    ] });
    expect(result.length).toBe(2);
    expect(result[0].type).toBe('sent');
    expect(result[0].delivered).toBeTrue();
    expect(result[1].type).toBe('received');
    expect(result[1].content).toBe('GPS reply');
  });

  it('searches the persistent test history with query and pagination', () => {
    service.getHistory('  Juan  ', 2, 20).subscribe();
    const request = http.expectOne(req => req.url === `${sessionsUrl}/history`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('Juan');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush({ data: [], total: 0, page: 2, lastPage: 1 });
  });

  it('reads paginated audit events without changing the session', () => {
    service.getLogs('test-1', 3, 50).subscribe();
    const request = http.expectOne(req => req.url === `${sessionsUrl}/test-1/logs`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('limit')).toBe('50');
    request.flush({ session: { sessionId: 'test-1' }, data: [], total: 0, page: 3, lastPage: 1 });
  });

  it('reads GPS connection from the same testing session without renewing or changing it', () => {
    service.getConnection('test-1').subscribe();
    const request = http.expectOne(`${sessionsUrl}/test-1/connection`);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush({ sessionId: 'test-1', status: 'online', lastCommunicationAt: null });
  });
});

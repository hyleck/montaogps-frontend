import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { InventoryService } from 'src/app/core/services/inventory.service';
import { SimcardTestingContext, SimcardTestingService, SimcardTestingSession, TestingConnection, TestingGpsPosition, TestingHistorySession, TestingLogEvent } from 'src/app/core/services/simcard-testing.service';
import { MapUtils } from 'src/app/shareds/helpers/map.helper';
import { SmsCommandsDialogComponent } from 'src/app/shareds/components/sms-commands-dialog/sms-commands-dialog.component';
import { SimcardTestingComponent } from './simcard-testing.component';

describe('Revisión Testing temporal en S5', () => {
  let fixture: ComponentFixture<SimcardTestingComponent>;
  let component: SimcardTestingComponent;
  let testing: jasmine.SpyObj<SimcardTestingService>;
  let inventory: jasmine.SpyObj<InventoryService>;
  const card = { _id: 'sim-1', iccid: '8910300000019069688', sim_company: 'global-m', idsim: '000123' };
  const gps = { _id: 'gps-1', IMEI: '123456789012345', Protocol: { _id: 'model-1', name: 'LB G900' } };
  const command = { commandIndex: 2, name: 'Ubicación', value: 'WHERE#', icon: 'pi pi-map-marker', canSend: true };
  const context: SimcardTestingContext = {
    sessionId: 'test-1',
    sim: { id: card._id, ...card }, modelName: 'LB G900', protocolId: 'model-1', serverId: 's5',
    commands: [command], canSend: true,
    quota: { remaining: 5, limit: 5, used: 0, unlimited: false },
  };
  const session: SimcardTestingSession = {
    sessionId: 'test-1', simId: card._id, inventoryId: gps._id, imei: gps.IMEI,
    protocolId: 'model-1', serverId: 's5', name: 'Testing GPS', status: 'active',
    expiresAt: '2026-09-29T20:00:00Z', restoreSubmitted: false, sim: context.sim,
    gps: { id: gps._id, imei: gps.IMEI, modelName: 'LB G900' }, server: { id: 's5', name: 'SERVER_5' },
  };
  const historySession: TestingHistorySession = {
    ...session, status: 'finished', ownerId: 'operator-1', ownerName: 'JUAN PEREZ',
    createdAt: '2026-09-29T18:00:00Z', finishedAt: '2026-09-29T18:30:00Z',
  };
  const logEvent: TestingLogEvent = {
    id: 'event-1', type: 'command_sent', message: 'Comando enviado', actorId: 'operator-1',
    actorName: 'JUAN PEREZ', occurredAt: '2026-09-29T18:10:00Z',
    details: { commandName: 'Ubicación', command: 'WHERE#', provider: 'myorion', direction: 'sent' },
  };
  const connection: TestingConnection = {
    sessionId: 'test-1', imei: gps.IMEI, sessionStatus: 'active', status: 'unknown',
    lastCommunicationAt: null, checkedAt: '2026-09-29T18:10:00Z',
  };
  const gpsPosition: TestingGpsPosition = {
    id: 10, latitude: 18.4861, longitude: -69.9312, fixTime: '2026-09-29T18:00:00Z',
    receivedAt: '2026-09-29T18:00:01Z', speed: 0, course: 180, accuracy: 5,
  };

  beforeEach(async () => {
    const map = jasmine.createSpyObj('map', ['on', 'off', 'resize', 'setCenter', 'setZoom', 'remove']);
    const marker = jasmine.createSpyObj('marker', ['setLngLat', 'addTo', 'remove', 'getElement']);
    marker.setLngLat.and.returnValue(marker);
    marker.addTo.and.returnValue(marker);
    marker.getElement.and.returnValue(document.createElement('div'));
    spyOn(MapUtils, 'createMap').and.returnValue(map);
    spyOn(MapUtils, 'getMapLibrary').and.returnValue({ Marker: jasmine.createSpy('Marker').and.returnValue(marker) });
    testing = jasmine.createSpyObj('SimcardTestingService', [
      'getActiveSession', 'startSession', 'getSession', 'heartbeat', 'finishSession', 'getContext', 'getMessages', 'sendCommand', 'getHistory', 'getLogs', 'getConnection',
    ]);
    testing.getActiveSession.and.returnValue(of(null));
    testing.startSession.and.returnValue(of(session));
    testing.getSession.and.returnValue(of(session));
    testing.heartbeat.and.returnValue(of(session));
    testing.finishSession.and.returnValue(of({ ...session, status: 'finished' }));
    testing.getContext.and.returnValue(of(context));
    testing.getMessages.and.returnValue(of([]));
    testing.sendCommand.and.returnValue(of({ success: true, quota: { ...context.quota, remaining: 4, used: 1 } }));
    testing.getHistory.and.returnValue(of({ data: [historySession], total: 1, page: 1, lastPage: 1 }));
    testing.getLogs.and.returnValue(of({ session: historySession, data: [logEvent], total: 1, page: 1, lastPage: 1 }));
    testing.getConnection.and.returnValue(of(connection));
    inventory = jasmine.createSpyObj('InventoryService', ['searchAllSimcards', 'searchAllDevices']);
    inventory.searchAllSimcards.and.returnValue(of({ data: [card], total: 1, page: 1, lastPage: 1 }));
    inventory.searchAllDevices.and.returnValue(of({ data: [gps], total: 1, page: 1, lastPage: 1 }));
    await TestBed.configureTestingModule({
      imports: [SimcardTestingComponent, NoopAnimationsModule],
      providers: [
        { provide: SimcardTestingService, useValue: testing },
        { provide: InventoryService, useValue: inventory },
        { provide: AuthService, useValue: { getCurrentUser: () => ({ affiliation_type_id: 'empleado' }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SimcardTestingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function start(): void {
    component.openTesting();
    component.selectSim(card);
    component.selectGps(gps);
    component.start();
  }

  it('requires both SIM and inventory GPS, and registers only on explicit start', fakeAsync(() => {
    (fixture.nativeElement.querySelector('.testing-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick(200);
    component.selectSim(card);
    component.start();
    expect(testing.startSession).not.toHaveBeenCalled();
    expect(testing.getContext).not.toHaveBeenCalled();
    (document.querySelector('.testing-gps-result') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.canStart).toBeTrue();
    (document.querySelector('.testing-button--primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick(200);
    expect(testing.startSession).toHaveBeenCalledOnceWith(card._id, gps._id);
    expect(testing.getContext).toHaveBeenCalledWith(card._id, session.sessionId);
    expect(testing.getMessages).toHaveBeenCalledWith(card._id, session.sessionId);
    expect(document.querySelector('.server-commands-title')?.textContent).toContain('LB G900');
    expect(document.querySelector('.testing-session-details')?.textContent).toContain(gps.IMEI);
    expect(document.querySelector('.testing-session-details')?.textContent).toContain('s5.dorhu.com');
    expect(document.querySelector('.testing-settings select')).toBeNull();
    expect(testing.sendCommand).not.toHaveBeenCalled();
    component.close();
    fixture.detectChanges();
    tick(200);
  }));

  it('cancels stale GPS search results and debounces the latest query', fakeAsync(() => {
    const oldSearch = new Subject<any>();
    inventory.searchAllDevices.and.returnValues(oldSearch, of({ data: [{ ...gps, _id: 'gps-2' }], total: 1, page: 1, lastPage: 1 }));
    component.openTesting();
    component.onGpsQueryChange('98765');
    oldSearch.next({ data: [gps], total: 1, page: 1, lastPage: 1 });
    expect(component.gpsResults).toEqual([]);
    tick(300);
    expect(inventory.searchAllDevices).toHaveBeenCalledWith('98765', undefined, 1, 20);
    expect(component.gpsResults[0]._id).toBe('gps-2');
    component.closeSetup();
  }));

  it('prevents duplicate registrations and changing selected equipment during start', () => {
    const pending = new Subject<SimcardTestingSession>();
    testing.startSession.and.returnValue(pending);
    start();
    component.start();
    component.selectSim({ ...card, _id: 'sim-2' });
    component.selectGps({ ...gps, _id: 'gps-2' });
    component.closeSetup();
    expect(testing.startSession).toHaveBeenCalledTimes(1);
    expect(component.selected?._id).toBe(card._id);
    expect(component.selectedGps?._id).toBe(gps._id);
    expect(component.setupVisible).toBeTrue();
    pending.next(session);
    expect(component.visible).toBeTrue();
    expect(component.setupVisible).toBeFalse();
  });

  it('starts and sends using the selected SIM and GPS despite different existing assignments', () => {
    const assignedSim = { ...card, installed: true, device_imei: '999999999999999' };
    const assignedGps = { ...gps, installed: true, SIM: 'other-sim-number', IDSIM: 'other-sim-id' };
    inventory.searchAllDevices.and.returnValue(of({ data: [assignedGps], total: 1, page: 1, lastPage: 1 }));
    component.openTesting();
    expect(inventory.searchAllDevices).toHaveBeenCalledWith('', undefined, 1, 20);
    component.selectSim(assignedSim);
    component.selectGps(assignedGps);
    expect(component.canStart).toBeTrue();
    component.start();
    expect(testing.startSession).toHaveBeenCalledOnceWith(assignedSim._id, assignedGps._id);
    component.sendCommand(command);
    expect(testing.sendCommand).toHaveBeenCalledOnceWith(assignedSim._id, command.commandIndex, session.sessionId);
    expect(component.session?.imei).toBe(assignedGps.IMEI);
    expect(component.session?.sim.iccid).toBe(assignedSim.iccid);
    expect(assignedSim.device_imei).toBe('999999999999999');
    expect(assignedGps.SIM).toBe('other-sim-number');
    expect(assignedGps.IDSIM).toBe('other-sim-id');
  });

  it('does not select MTAG devices that cannot use SIM or SMS commands', () => {
    component.selectGps({ ...gps, Protocol: { name: 'MTAG-A' } });
    expect(component.selectedGps).toBeNull();
    component.selectGps({ ...gps, Protocol: { name: 'Custom tracker', isAirtag: true } });
    expect(component.selectedGps).toBeNull();
  });

  it('reports an original-server command as sent without asserting GPS connectivity', () => {
    testing.finishSession.and.returnValue(of({ ...session, status: 'finished', restoreSubmitted: true }));
    start();
    component.close();
    expect(component.feedback).toContain('Se envió la configuración del servidor original.');
    expect(component.feedback).not.toContain('conectado');
  });

  it('requires checking for an existing registration after an uncertain start response', () => {
    testing.startSession.and.returnValue(throwError(() => ({ error: { message: 'Sin respuesta' } })));
    start();
    expect(component.error).toBe('Sin respuesta');
    expect(component.canStart).toBeFalse();
    component.start();
    expect(testing.startSession).toHaveBeenCalledTimes(1);
    testing.getActiveSession.and.returnValue(of(session));
    component.recoverSession();
    expect(component.visible).toBeTrue();
    expect(component.session?.sessionId).toBe('test-1');
  });

  it('restores the operator active session after reload without creating another GPS', () => {
    testing.getActiveSession.and.returnValue(of(session));
    component.ngOnInit();
    expect(component.visible).toBeTrue();
    expect(component.session?.imei).toBe(gps.IMEI);
    expect(testing.getContext).toHaveBeenCalledWith(card._id, 'test-1');
    expect(testing.startSession).not.toHaveBeenCalled();
  });

  it('shows completion directly when an abandoned session was cleaned up during recovery', () => {
    testing.getActiveSession.and.returnValue(of({ ...session, status: 'finished' }));
    component.recoverSession();
    expect(component.visible).toBeFalse();
    expect(component.session).toBeNull();
    expect(component.feedback).toContain('Prueba finalizada');
    expect(testing.getContext).not.toHaveBeenCalled();
    expect(testing.startSession).not.toHaveBeenCalled();
  });

  it('finishes on panel close and keeps it visible until S5 removal is confirmed', fakeAsync(() => {
    const pending = new Subject<SimcardTestingSession>();
    testing.finishSession.and.returnValue(pending);
    start();
    fixture.detectChanges();
    tick(200);
    const dialog = fixture.debugElement.query(By.directive(SmsCommandsDialogComponent)).componentInstance as SmsCommandsDialogComponent;
    dialog.onVisibleChange(false);
    fixture.detectChanges();
    expect(testing.finishSession).toHaveBeenCalledOnceWith('test-1');
    expect(component.visible).toBeTrue();
    expect(dialog.visible).toBeTrue();
    expect(component.ending).toBeTrue();
    expect(component.sendDisabled).toBeTrue();
    pending.next({ ...session, status: 'finished' });
    fixture.detectChanges();
    tick(200);
    expect(component.visible).toBeFalse();
    expect(component.feedback).toContain('retirado del servidor 5');
  }));

  it('keeps cleanup failures visible and allows retry without further SMS or heartbeat', fakeAsync(() => {
    testing.finishSession.and.returnValues(
      of({ ...session, status: 'cleanup_pending', reason: 'Servidor no disponible' }),
      of({ ...session, status: 'finished' }),
    );
    start();
    component.close();
    expect(component.sessionError).toBe('Servidor no disponible');
    expect(component.visible).toBeTrue();
    component.sendCommand(command);
    tick(30000);
    expect(testing.heartbeat).not.toHaveBeenCalled();
    expect(testing.sendCommand).not.toHaveBeenCalled();
    component.close();
    expect(testing.finishSession).toHaveBeenCalledTimes(2);
    expect(component.visible).toBeFalse();
  }));

  it('shows transport failures when finishing without claiming the GPS was removed', () => {
    testing.finishSession.and.returnValue(throwError(() => ({ error: { message: 'Error de conexión' } })));
    start();
    component.close();
    expect(component.visible).toBeTrue();
    expect(component.sessionError).toBe('Error de conexión');
    expect(component.sendDisabled).toBeTrue();
    expect(component.feedback).not.toContain('retirado');
  });

  it('sends only the session and original command index and blocks duplicate sends and close while sending', () => {
    const pending = new Subject<any>();
    testing.sendCommand.and.returnValue(pending);
    start();
    component.sendCommand(command);
    component.sendCommand(command);
    component.close();
    expect(testing.sendCommand).toHaveBeenCalledOnceWith('sim-1', 2, 'test-1');
    expect(testing.finishSession).not.toHaveBeenCalled();
    pending.next({ success: true, quota: { ...context.quota, remaining: 4, used: 1 } });
    expect(component.context?.quota.remaining).toBe(4);
    expect(component.sending).toBeFalse();
  });

  it('blocks sends when permission, quota or command resolution denies them', () => {
    start();
    component.context = { ...context, canSend: false };
    component.sendCommand(command);
    component.context = { ...context, quota: { ...context.quota, remaining: 0 } };
    component.sendCommand(command);
    component.context = context;
    component.sendCommand({ ...command, canSend: false });
    expect(testing.sendCommand).not.toHaveBeenCalled();
  });

  it('keeps the session open when context or history fail so it can still be finalized', () => {
    testing.getContext.and.returnValue(throwError(() => ({ error: { message: 'Comandos no disponibles' } })));
    testing.getMessages.and.returnValue(throwError(() => ({ error: { message: 'Historial no disponible' } })));
    start();
    expect(component.error).toBe('Comandos no disponibles');
    expect(component.historyError).toBe('Historial no disponible');
    expect(component.sendDisabled).toBeTrue();
    component.close();
    expect(testing.finishSession).toHaveBeenCalledWith('test-1');
    expect(component.visible).toBeFalse();
  });

  it('polls status and keeps the lease active, then stops polling after finalization', fakeAsync(() => {
    start();
    tick(30000);
    expect(testing.getSession).toHaveBeenCalledTimes(2);
    expect(testing.getMessages).toHaveBeenCalledTimes(3);
    expect(testing.heartbeat).toHaveBeenCalledOnceWith('test-1');
    component.close();
    tick(30000);
    expect(testing.getSession).toHaveBeenCalledTimes(2);
    expect(testing.heartbeat).toHaveBeenCalledTimes(1);
  }));

  it('stops renewing on navigation so abandoned sessions can expire on the server', fakeAsync(() => {
    start();
    fixture.destroy();
    tick(60000);
    expect(testing.heartbeat).not.toHaveBeenCalled();
    expect(testing.getSession).not.toHaveBeenCalled();
    expect(testing.finishSession).not.toHaveBeenCalled();
  }));

  it('opens durable history with user names in title case and readable command details', fakeAsync(() => {
    (fixture.nativeElement.querySelector('.testing-history-open') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick(200);
    expect(document.querySelector('.testing-history-item')?.textContent).toContain('Juan Perez');
    expect(document.querySelector('.testing-history-item')?.textContent).toContain('Finalizada');
    (document.querySelector('.testing-history-item') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(testing.getLogs).toHaveBeenCalledOnceWith('test-1', 1, 50);
    const timeline = document.querySelector('.testing-log-timeline')?.textContent || '';
    expect(timeline).toContain('Comando enviado');
    expect(timeline).toContain('Juan Perez');
    expect(timeline).toContain('WHERE#');
    expect(timeline).toContain('Enviado');
    expect(testing.startSession).not.toHaveBeenCalled();
    expect(testing.finishSession).not.toHaveBeenCalled();
    component.closeHistory();
    fixture.detectChanges();
    tick(200);
  }));

  it('searches history by the supplied query and cancels stale results', () => {
    const stale = new Subject<any>();
    testing.getHistory.and.returnValues(stale, of({ data: [], total: 0, page: 1, lastPage: 0 }));
    component.openHistory();
    component.testHistoryQuery = '89103 Juan';
    component.loadHistory(1);
    stale.next({ data: [historySession], total: 1, page: 1, lastPage: 1 });
    expect(testing.getHistory).toHaveBeenCalledWith('89103 Juan', 1, 20);
    expect(component.testHistory).toEqual([]);
    expect(component.testHistoryLastPage).toBe(1);
  });

  it('paginates both the session list and chronological logs', () => {
    testing.getHistory.and.returnValue(of({ data: [historySession], total: 45, page: 2, lastPage: 3 }));
    component.openHistory();
    component.loadHistory(2);
    expect(testing.getHistory).toHaveBeenCalledWith('', 2, 20);
    expect(component.testHistoryPage).toBe(2);
    testing.getLogs.and.returnValue(of({ session: historySession, data: [logEvent], total: 120, page: 2, lastPage: 3 }));
    component.openLogs('test-1');
    component.loadLogs(2);
    expect(testing.getLogs).toHaveBeenCalledWith('test-1', 2, 50);
    expect(component.logsTotal).toBe(120);
    component.backToHistory();
    expect(testing.getHistory).toHaveBeenCalledWith('', 2, 20);
    expect(component.logSessionId).toBe('');
  });

  it('keeps an active test and heartbeat running while reading its logs', fakeAsync(() => {
    start();
    component.openLogs('test-1');
    component.close();
    expect(testing.finishSession).not.toHaveBeenCalled();
    tick(30000);
    expect(testing.heartbeat).toHaveBeenCalledOnceWith('test-1');
    component.closeHistory();
    expect(component.visible).toBeTrue();
    expect(component.session?.sessionId).toBe('test-1');
    expect(testing.finishSession).not.toHaveBeenCalled();
    component.close();
  }));

  it('lets the operator read another user history without operating that session', () => {
    testing.getLogs.and.returnValue(of({ session: { ...historySession, ownerId: 'another-user', sessionId: 'other-test' }, data: [logEvent], total: 1, page: 1, lastPage: 1 }));
    start();
    component.openLogs('other-test');
    expect(component.logSession?.sessionId).toBe('other-test');
    expect(component.session?.sessionId).toBe('test-1');
    component.closeHistory();
    component.close();
    expect(testing.finishSession).toHaveBeenCalledOnceWith('test-1');
  });

  it('keeps history available after the temporary GPS has been removed', () => {
    start();
    component.close();
    expect(component.session).toBeNull();
    component.openHistory();
    component.openLogs(historySession.sessionId);
    expect(component.logSession?.status).toBe('finished');
    expect(component.logEvents).toEqual([logEvent]);
    expect(component.visible).toBeFalse();
  });

  it('shows recoverable list and detail errors and ignores late detail responses', () => {
    testing.getHistory.and.returnValue(throwError(() => ({ error: { message: 'Historial no disponible' } })));
    component.openHistory();
    component.loadHistory(2);
    expect(component.testHistoryError).toBe('Historial no disponible');
    expect(component.testHistoryPage).toBe(2);
    testing.getLogs.and.returnValue(throwError(() => ({ error: { message: 'Registro no disponible' } })));
    component.openLogs('test-1');
    component.loadLogs(3);
    expect(component.logsError).toBe('Registro no disponible');
    expect(component.logsPage).toBe(3);
    const late = new Subject<any>();
    testing.getLogs.and.returnValue(late);
    component.loadLogs(1);
    component.closeHistory();
    late.next({ session: historySession, data: [logEvent], total: 1, page: 1, lastPage: 1 });
    expect(component.logSession).toBeNull();
    expect(component.logEvents).toEqual([]);
    expect(component.logsVisible).toBeFalse();
  });

  it('renders empty history and events with a clear message', fakeAsync(() => {
    testing.getHistory.and.returnValue(of({ data: [], total: 0, page: 1, lastPage: 0 }));
    component.openHistory();
    fixture.detectChanges();
    tick(200);
    expect(document.querySelector('.testing-log-empty')?.textContent).toContain('Todavía no hay pruebas registradas');
    testing.getLogs.and.returnValue(of({ session: historySession, data: [], total: 0, page: 1, lastPage: 0 }));
    component.openLogs('test-1');
    fixture.detectChanges();
    expect(document.querySelector('.testing-log-empty')?.textContent).toContain('No hay eventos disponibles para esta prueba');
    component.closeHistory();
    fixture.detectChanges();
    tick(200);
  }));

  it('shows known human-readable event fields without exposing arbitrary payloads', () => {
    const details = component.logDetails({ ...logEvent, details: {
      content: 'GPS respondió', direction: 'received', delivered: true, reason: 'Tiempo de espera agotado',
      secret: 'hidden', result: { token: 'hidden' },
    } });
    expect(details.map(row => row.value)).toEqual(['GPS respondió', 'Recibido', 'Sí', 'Tiempo de espera agotado']);
    expect(JSON.stringify(details)).not.toContain('hidden');
    expect(component.logIsError({ ...logEvent, type: 'command_failed' })).toBeTrue();
    expect(component.logIsError({ ...logEvent, type: 'command_uncertain' })).toBeTrue();
  });

  it('closes the logs overlay with Escape without finalizing the active GPS test', fakeAsync(() => {
    start();
    fixture.detectChanges();
    tick(200);
    component.openLogs('test-1');
    fixture.detectChanges();
    tick(200);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    fixture.detectChanges();
    tick(200);
    expect(component.logsVisible).toBeFalse();
    expect(component.visible).toBeTrue();
    expect(testing.finishSession).not.toHaveBeenCalled();
    component.close();
    fixture.detectChanges();
    tick(200);
  }));

  it('shows GPS online and offline independently of the active temporary registration', fakeAsync(() => {
    testing.getConnection.and.returnValues(of({ ...connection, status: 'online' }), of({ ...connection, status: 'offline' }));
    start();
    fixture.detectChanges();
    tick(200);
    expect(document.querySelector('.testing-connection-badge')?.getAttribute('data-status')).toBe('online');
    expect(document.querySelector('.testing-connection-badge')?.textContent).toContain('En línea');
    expect(component.connection?.lastCommunicationAt).toBeNull();
    component.refreshConnection();
    fixture.detectChanges();
    expect(document.querySelector('.testing-connection-badge')?.textContent).toContain('Fuera de línea');
    expect(component.session?.status).toBe('active');
    component.close();
    fixture.detectChanges();
    tick(200);
  }));

  it('shows unknown communication without inventing a timestamp or assuming active means online', () => {
    start();
    expect(testing.getConnection).toHaveBeenCalledOnceWith('test-1');
    expect(component.connectionLabel).toBe('Estado desconocido');
    expect(component.connection?.lastCommunicationAt).toBeNull();
    expect(component.session?.status).toBe('active');
  });

  it('refreshes GPS every five seconds while sending commands and reading logs without extra heartbeats', fakeAsync(() => {
    const sending = new Subject<any>();
    testing.sendCommand.and.returnValue(sending);
    start();
    component.sendCommand(command);
    component.openLogs('other-test');
    tick(10000);
    expect(testing.getConnection).toHaveBeenCalledTimes(3);
    expect(testing.getConnection.calls.allArgs()).toEqual([['test-1'], ['test-1'], ['test-1']]);
    expect(testing.heartbeat).not.toHaveBeenCalled();
    sending.next({ success: true, quota: context.quota });
    component.closeHistory();
    component.close();
  }));

  it('does not overlap connection requests and times out an unresponsive request', fakeAsync(() => {
    const pending = new Subject<TestingConnection>();
    testing.getConnection.and.returnValue(pending);
    start();
    component.refreshConnection();
    tick(10000);
    expect(testing.getConnection).toHaveBeenCalledTimes(1);
    tick(5001);
    expect(component.connectionStatus).toBe('unavailable');
    expect(component.connectionError).toContain('No se pudo consultar');
    component.close();
  }));

  it('drops green after transport failure and keeps the last communication clearly available as historical', () => {
    const timestamp = '2026-09-29T18:09:00Z';
    testing.getConnection.and.returnValues(
      of({ ...connection, status: 'online', lastCommunicationAt: timestamp }),
      throwError(() => ({ error: { message: 'S5 no responde' } })),
    );
    start();
    component.refreshConnection();
    expect(component.connectionStatus).toBe('unavailable');
    expect(component.connectionLabel).toBe('No disponible');
    expect(component.connectionError).toBe('S5 no responde');
    expect(component.connection?.lastCommunicationAt).toBe(timestamp);
  });

  it('preserves known communication when the server returns unavailable without a timestamp', () => {
    const timestamp = '2026-09-29T18:09:00Z';
    testing.getConnection.and.returnValues(
      of({ ...connection, status: 'online', lastCommunicationAt: timestamp }),
      of({ ...connection, status: 'unavailable', reason: 'S5 no disponible' }),
    );
    start();
    component.refreshConnection();
    expect(component.connectionStatus).toBe('unavailable');
    expect(component.connection?.lastCommunicationAt).toBe(timestamp);
  });

  it('expires a previously green result after fifteen seconds without a successful reply', fakeAsync(() => {
    const pending = new Subject<TestingConnection>();
    testing.getConnection.and.returnValues(of({ ...connection, status: 'online' }), pending);
    start();
    tick(15001);
    expect(component.connectionStale).toBeTrue();
    expect(component.connectionStatus).toBe('unavailable');
    expect(component.connectionLabel).toBe('Estado desactualizado');
    component.close();
  }));

  it('uses local response age when browser and server clocks differ and catches stale data after backgrounding', () => {
    const localTime = 2000000000000;
    const clock = spyOn(Date, 'now').and.returnValue(localTime);
    testing.getConnection.and.returnValue(of({ ...connection, status: 'online', checkedAt: '2020-01-01T00:00:00Z' }));
    start();
    expect(component.connectionStatus).toBe('online');
    clock.and.returnValue(localTime + 16000);
    expect(component.connectionStale).toBeTrue();
    expect(component.connectionStatus).toBe('unavailable');
    component.onVisibilityChange();
    expect(testing.getConnection).toHaveBeenCalledTimes(2);
    expect(component.connectionStatus).toBe('online');
  });

  it('cancels connection monitoring before deletion and ignores late online results', fakeAsync(() => {
    const pending = new Subject<TestingConnection>();
    const removal = new Subject<SimcardTestingSession>();
    testing.getConnection.and.returnValue(pending);
    testing.finishSession.and.returnValue(removal);
    start();
    component.close();
    expect(component.connection).toBeNull();
    pending.next({ ...connection, status: 'online' });
    tick(10000);
    expect(component.connection).toBeNull();
    expect(testing.getConnection).toHaveBeenCalledTimes(1);
    removal.next({ ...session, status: 'finished' });
  }));

  it('stops connection polling when the session enters cleanup and on component destruction', fakeAsync(() => {
    testing.getSession.and.returnValue(of({ ...session, status: 'cleanup_pending' }));
    start();
    tick(15000);
    const requests = testing.getConnection.calls.count();
    expect(component.connection).toBeNull();
    tick(15000);
    expect(testing.getConnection.calls.count()).toBe(requests);
    fixture.destroy();
    tick(30000);
    expect(testing.getConnection.calls.count()).toBe(requests);
  }));

  it('does not accept a connection result for another session or GPS', () => {
    testing.getConnection.and.returnValue(of({ ...connection, sessionId: 'other-test', status: 'online' }));
    start();
    expect(component.connection).toBeNull();
    expect(component.connectionStatus).toBe('unavailable');
    testing.getConnection.and.returnValue(of({ ...connection, imei: 'another-gps', status: 'online' }));
    component.refreshConnection();
    expect(component.connection).toBeNull();
    expect(component.connectionStatus).toBe('unavailable');
  });

  it('links received SMS coordinates in saved logs to Google Maps and preserves the original text', fakeAsync(() => {
    const content = 'GPS: lat:18.4861 lon:-69.9312';
    const received = { ...logEvent, type: 'sms_received', details: { content } };
    testing.getLogs.and.returnValue(of({ session: historySession, data: [received], total: 1, page: 1, lastPage: 1 }));
    component.openLogs('test-1');
    fixture.detectChanges();
    tick(200);
    const link = document.querySelector('.testing-log-location') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('Ver en Google Maps');
    expect(link.href).toContain('google.com/maps');
    expect(decodeURIComponent(link.href)).toContain('18.4861,-69.9312');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
    expect(document.querySelector('.testing-log-code')?.textContent).toBe(content);
    component.closeHistory();
    fixture.detectChanges();
    tick(200);
  }));

  it('does not create maps links for sent SMS or received SMS without coordinates', fakeAsync(() => {
    const sent = { ...logEvent, id: 'sent', type: 'sms_sent', details: { content: 'GPS: lat:18.4861 lon:-69.9312' } };
    const received = { ...logEvent, id: 'received', type: 'sms_received', details: { content: 'Batería: 80%' } };
    testing.getLogs.and.returnValue(of({ session: historySession, data: [sent, received], total: 2, page: 1, lastPage: 1 }));
    component.openLogs('test-1');
    fixture.detectChanges();
    tick(200);
    expect(document.querySelector('.testing-log-location')).toBeNull();
    expect(document.querySelector('.testing-log-timeline')?.textContent).toContain('Batería: 80%');
    component.closeHistory();
    fixture.detectChanges();
    tick(200);
  }));

  it('updates the testing map only from connection position and keeps the fix date distinct from communication', fakeAsync(() => {
    testing.getConnection.and.returnValues(
      of({ ...connection, status: 'online', lastCommunicationAt: '2026-09-29T18:10:00Z', position: gpsPosition }),
      of({ ...connection, status: 'online', position: { ...gpsPosition, id: 11, latitude: 18.49, fixTime: '2026-09-29T18:10:05Z' } }),
    );
    start();
    fixture.detectChanges();
    tick(200);
    expect(component.testingPosition?.fixTime).toBe('2026-09-29T18:00:00Z');
    expect(component.connection?.lastCommunicationAt).toBe('2026-09-29T18:10:00Z');
    expect(component.testingPositionStale).toBeFalse();
    expect(document.querySelector('app-testing-gps-map')).not.toBeNull();
    tick(5000);
    fixture.detectChanges();
    tick();
    expect(component.testingPosition?.latitude).toBe(18.49);
    expect(component.testingPosition?.fixTime).toBe('2026-09-29T18:10:05Z');
    expect(MapUtils.createMap).toHaveBeenCalledTimes(1);
    component.close();
    fixture.detectChanges();
    tick(200);
    expect(component.testingPosition).toBeNull();
    expect(document.querySelector('app-testing-gps-map')).toBeNull();
  }));

  it('retains the last valid position and its date after invalid coordinates, fallback or failed polling', () => {
    testing.getConnection.and.returnValues(
      of({ ...connection, status: 'online', position: gpsPosition }),
      of({ ...connection, status: 'online', position: { ...gpsPosition, id: 11, latitude: 0, longitude: 0, fixTime: '2026-09-29T19:00:00Z' } }),
      of({ ...connection, status: 'online', position: gpsPosition, positionReason: 'Se descartó un reporte inválido.' }),
      throwError(() => ({ error: { message: 'Sin conexión con S5' } })),
    );
    start();
    component.refreshConnection();
    expect(component.testingPosition).toEqual(gpsPosition);
    expect(component.testingPositionStale).toBeTrue();
    component.refreshConnection();
    expect(component.testingPosition).toEqual(gpsPosition);
    expect(component.testingPositionStale).toBeTrue();
    component.refreshConnection();
    expect(component.testingPosition?.fixTime).toBe(gpsPosition.fixTime);
    expect(component.testingPositionStale).toBeTrue();
  });

  it('keeps the map empty for missing positions even when SMS includes coordinates', () => {
    testing.getMessages.and.returnValue(of([{ type: 'received', content: 'lat:18.4861 lon:-69.9312', timestamp: new Date() }]));
    start();
    expect(component.testingPosition).toBeNull();
    expect(MapUtils.createMap).not.toHaveBeenCalled();
    testing.getConnection.and.returnValue(of({ ...connection, sessionId: 'other-test', status: 'online', position: gpsPosition }));
    component.refreshConnection();
    expect(component.testingPosition).toBeNull();
  });

  it('labels offline positions as last known and clears them before starting another session', () => {
    testing.getConnection.and.returnValue(of({ ...connection, status: 'offline', position: gpsPosition }));
    start();
    expect(component.testingPositionStale).toBeTrue();
    component.close();
    expect(component.testingPosition).toBeNull();
    testing.getConnection.and.returnValue(of({ ...connection, sessionId: 'test-2', position: null }));
    testing.startSession.and.returnValue(of({ ...session, sessionId: 'test-2' }));
    start();
    expect(component.session?.sessionId).toBe('test-2');
    expect(component.testingPosition).toBeNull();
    expect(component.testingPositionStale).toBeFalse();
  });
});

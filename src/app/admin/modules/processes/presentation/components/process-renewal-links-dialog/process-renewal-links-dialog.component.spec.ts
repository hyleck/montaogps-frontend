import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { CreatedRenewalLink, ExecuteRenewalLink, RenewalLinkExecution, RenewalLinkPreview, RenewalLinkPreviewItem, RenewalLinkSummary, RenewalLinksService } from 'src/app/core/services/renewal-links.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ProcessRenewalLinksDialogComponent } from './process-renewal-links-dialog.component';

describe('ProcessRenewalLinksDialogComponent', () => {
  let fixture: ComponentFixture<ProcessRenewalLinksDialogComponent>;
  let component: ProcessRenewalLinksDialogComponent;
  let service: jasmine.SpyObj<RenewalLinksService>;
  let auth: jasmine.SpyObj<AuthService>;
  const client = { id: 'client-1', label: 'MARIA GARCIA', email: 'maria@example.com', phone: '8095550100' };
  const created: CreatedRenewalLink = { id: 'link-1', token: 'secret-token', client: { id: client.id, name: client.label }, deviceCount: 2, expiresAt: '2026-10-06T12:00:00Z' };
  const active: RenewalLinkSummary = { id: created.id, client: created.client, createdAt: '2026-09-29T12:00:00Z', expiresAt: created.expiresAt, status: 'active', deviceCount: 2 };
  const response: RenewalLinkSummary = { ...active, id: 'response-1', status: 'submitted', renewalMethod: 'credit', submittedAt: '2026-09-29T13:00:00Z', decisions: [
    { deviceId: 'device-1', name: 'Toyota', imei: '123', renew: true, expirationDate: '2026-09-20T00:00:00.000Z' },
    { deviceId: 'device-2', name: 'Honda', imei: '456', renew: false },
  ] };

  beforeEach(async () => {
    service = jasmine.createSpyObj('RenewalLinksService', ['create', 'getForClient', 'revoke', 'preview', 'execute']);
    auth = jasmine.createSpyObj('AuthService', ['hasPrivilege', 'getCurrentUser']);
    auth.hasPrivilege.and.returnValue(true);
    auth.getCurrentUser.and.returnValue(null);
    service.create.and.returnValue(of(created));
    service.getForClient.and.returnValue(of([active, response]));
    service.revoke.and.returnValue(of({ ...active, status: 'revoked' }));
    service.execute.and.returnValue(of(completedResponse()));
    service.preview.and.callFake((_id, request) => of(previewResponse(component?.selectedLink || response, request)));
    await TestBed.configureTestingModule({ imports: [ProcessRenewalLinksDialogComponent, NoopAnimationsModule], providers: [
      { provide: RenewalLinksService, useValue: service }, { provide: AuthService, useValue: auth },
    ] }).compileComponents();
    fixture = TestBed.createComponent(ProcessRenewalLinksDialogComponent);
    component = fixture.componentInstance;
    spyOn<any>(component, 'localToday').and.returnValue('2026-09-29');
  });
  afterEach(() => fixture.destroy());

  function open(mode: 'generate' | 'responses' = 'generate') {
    fixture.componentRef.setInput('client', client);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  function execution(overrides: Partial<RenewalLinkExecution> = {}): RenewalLinkExecution {
    return {
      action: 'renewal', years: 1, registrationDate: '2026-09-29', status: 'completed',
      startedAt: '2026-09-29T15:00:00Z', finishedAt: '2026-09-29T15:01:00Z',
      actor: { id: 'staff-1', name: 'MARIA PEREZ' }, succeeded: 1, failed: 0, pending: 0,
      results: [{ deviceId: 'device-1', status: 'succeeded', processId: 'process-1', expirationDate: '2027-09-20' }],
      ...overrides,
    };
  }

  function completedResponse(overrides: Partial<RenewalLinkExecution> = {}): RenewalLinkSummary {
    return { ...response, execution: execution(overrides) };
  }

  function previewResponse(link: RenewalLinkSummary, request: ExecuteRenewalLink): RenewalLinkPreview {
    return { items: (link.decisions || []).map<RenewalLinkPreviewItem>(decision => {
      const completed = link.execution?.results.some(result => result.deviceId === decision.deviceId && result.status === 'succeeded');
      const changes = decision.renew && !completed;
      return {
        deviceId: decision.deviceId, renew: decision.renew, canExecute: changes,
        currentExpirationDate: decision.expirationDate,
        expirationDate: changes && request.action === 'renewal' ? request.expirationDate || '2027-09-20' : decision.expirationDate,
        requestedExpirationDate: changes ? request.expirationDate || '2027-09-20' : undefined,
        effect: completed ? 'completed' : !decision.renew ? 'unchanged' : request.action,
      };
    }) };
  }

  function previewItems(...items: RenewalLinkPreviewItem[]): RenewalLinkPreview {
    return { items: items.some(item => item.deviceId === 'device-2') ? items : [
      ...items, { deviceId: 'device-2', renew: false, canExecute: false, effect: 'unchanged' },
    ] };
  }

  function deviceRow(name: string): HTMLTableRowElement {
    return Array.from(fixture.nativeElement.querySelectorAll('.renewal-response-table tbody tr') as NodeListOf<HTMLTableRowElement>)
      .find(row => row.textContent?.includes(name))!;
  }

  function currentExpirationText(name: string): string {
    const cell = deviceRow(name).querySelector('.renewal-preview-date')!.cloneNode(true) as HTMLElement;
    cell.querySelectorAll('small').forEach(snapshot => snapshot.remove());
    return cell.textContent?.trim() || '';
  }

  function begin(action: 'renewal' | 'pre_renewal' = 'renewal') {
    if (action === 'pre_renewal') service.getForClient.and.returnValue(of([{ ...response, renewalMethod: 'cash' }]));
    openResponse(); component.beginExecution(action); component.registrationDate = '2026-09-29';
  }

  function openResponse() {
    open('responses');
    component.selectResponse(component.links.find(link => link.status === 'submitted')!);
    fixture.detectChanges();
  }

  it('generates a link without date bounds and displays its shareable URL and responses', () => {
    open();
    expect(service.create).toHaveBeenCalledOnceWith(client.id, { dateFrom: undefined, dateTo: undefined });
    expect(service.getForClient).toHaveBeenCalledOnceWith(client.id);
    expect(component.clientName).toBe('Maria Garcia');
    expect(component.linkUrl).toBe(`${window.location.origin}/renovar/secret-token`);
    expect(fixture.nativeElement.textContent).toContain('Enlace listo para compartir');
    expect(fixture.nativeElement.textContent).toContain('Ver respuesta');
    expect(fixture.nativeElement.querySelector('.renewal-client-response')).toBeNull();
    expect(component.renewalCount(response)).toBe(1);
    expect(component.declineCount(response)).toBe(1);
  });

  it('sends the selected calendar range and displays the range saved in the link separately from its validity', () => {
    fixture.componentRef.setInput('dateFrom', new Date(2026, 8, 1));
    fixture.componentRef.setInput('dateTo', new Date(2026, 8, 30, 23, 59));
    service.create.and.returnValue(of({ ...created,
      expirationFilter: { mode: 'range', dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    }));
    open();
    expect(service.create).toHaveBeenCalledOnceWith(client.id, { dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const range = fixture.nativeElement.querySelector('.renewal-created-range').textContent;
    expect(range).toContain('Del 01/09/2026 al 30/09/2026');
    expect(range).not.toContain('06/10/2026');
    expect(fixture.nativeElement.textContent).toContain('cliente y sus subcuentas');
  });

  it('sends an open-ended range without inventing another date', () => {
    fixture.componentRef.setInput('dateFrom', new Date(2026, 8, 1));
    open();
    expect(service.create).toHaveBeenCalledOnceWith(client.id, { dateFrom: '2026-09-01', dateTo: undefined });
  });

  it('rejects reversed date bounds before creating a link', () => {
    fixture.componentRef.setInput('dateFrom', new Date(2026, 9, 1));
    fixture.componentRef.setInput('dateTo', new Date(2026, 8, 1));
    open();
    expect(service.create).not.toHaveBeenCalled();
    expect(component.error).toContain('rango de vencimientos válido');
  });

  it('shows the saved range when reviewing the client response', () => {
    service.getForClient.and.returnValue(of([{ ...response,
      expirationFilter: { mode: 'range', dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    }]));
    openResponse();
    expect(fixture.nativeElement.querySelector('.renewal-response-dates').textContent).toContain('Del 01/09/2026 al 30/09/2026');
  });

  it('opens the response list without automatically selecting a response or creating another link', () => {
    open('responses');
    expect(service.create).not.toHaveBeenCalled();
    expect(component.selectedLink).toBeUndefined();
    expect(component.responseVisible).toBeFalse();
    expect(component.linkUrl).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('Toyota');
    expect(fixture.nativeElement.textContent).not.toContain('Honda');
  });

  it('blocks repeated generation until the current request finishes', () => {
    const pending = new Subject<CreatedRenewalLink>();
    service.create.and.returnValue(pending);
    open(); component.generate();
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(component.creating).toBeTrue();
    pending.next(created);
    expect(component.creating).toBeFalse();
  });

  it('clears the URL after revocation and keeps the saved selection', () => {
    open(); component.revoke(active); fixture.detectChanges();
    expect(service.revoke).toHaveBeenCalledOnceWith(active.id);
    expect(component.links[0].status).toBe('revoked');
    expect(component.created).toBeNull();
    expect(component.linkUrl).toBe('');
    expect(component.links).toContain(response);
    expect(fixture.nativeElement.querySelector('#renewal-public-link')).toBeNull();
  });

  it('rejects hidden or clientless creation and revocation of a submitted link', () => {
    component.generate();
    expect(service.create).not.toHaveBeenCalled();
    component.visible = true; component.generate();
    expect(service.create).not.toHaveBeenCalled();
    expect(component.error).toContain('Selecciona un cliente');
    component.revoke(response);
    expect(service.revoke).not.toHaveBeenCalled();
  });

  it('ignores results after closing and when the selected client changes', () => {
    const pending = new Subject<CreatedRenewalLink>();
    service.create.and.returnValue(pending);
    open();
    const visibility = spyOn(component.visibleChange, 'emit');
    component.close(); pending.next(created);
    expect(component.created).toBeNull();
    expect(service.getForClient).not.toHaveBeenCalled();
    expect(visibility).toHaveBeenCalledWith(false);

    component.visible = true; component.client = client;
    component.ngOnChanges({ visible: new SimpleChange(false, true, false) });
    service.create.and.returnValue(of({ ...created, client: { id: 'client-2', name: 'Otro' } }));
    component.client = { id: 'client-2', label: 'Otro' };
    component.ngOnChanges({ client: new SimpleChange(client, component.client, false) });
    pending.next(created);
    expect(component.created?.client.id).toBe('client-2');
    expect(service.getForClient).toHaveBeenCalledOnceWith('client-2');
  });

  it('shows generation errors and lets staff retry without hiding response history', () => {
    service.create.and.returnValue(throwError(() => ({ error: { message: 'No hay dispositivos.' } })));
    open();
    expect(component.error).toContain('No hay dispositivos');
    expect(component.links).toContain(response);
    service.create.and.returnValue(of(created)); component.generate();
    expect(component.error).toBe('');
    expect(component.created).toEqual(created);
  });

  it('prevents a history refresh from racing a revoke request', () => {
    const pending = new Subject<RenewalLinkSummary>();
    service.revoke.and.returnValue(pending);
    open(); component.revoke(active); component.refresh(); component.generate();
    expect(service.getForClient).toHaveBeenCalledTimes(1);
    expect(service.create).toHaveBeenCalledTimes(1);
    pending.next({ ...active, status: 'revoked' });
    component.refresh();
    expect(service.getForClient).toHaveBeenCalledTimes(2);
  });

  it('offers the configured action only for the client devices marked to renew and requires confirmation', () => {
    begin();
    expect(component.remainingCount).toBe(1);
    expect(component.renewalYears).toBe(1);
    expect(component.useCommonExpiration).toBeFalse();
    expect(service.execute).not.toHaveBeenCalled();
    component.confirmExecution();
    expect(service.execute).not.toHaveBeenCalled();
    component.previewExecution(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Confirmar: Renovar ( Facturación a crédito ) de 1 GPS');
    const processed = spyOn(component.processed, 'emit');
    component.confirmExecution();
    expect(service.execute).toHaveBeenCalledOnceWith(response.id, { action: 'renewal', years: 1, registrationDate: '2026-09-29' });
    expect(processed).toHaveBeenCalledTimes(1);
    expect(component.remainingCount).toBe(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Renovado');
    expect(fixture.nativeElement.textContent).toContain('Sin acción');
    expect(fixture.nativeElement.textContent).toContain('Maria Perez');
  });

  it('sends an explicit common date, duration, registration and trimmed observation for pre-renewal', () => {
    service.execute.and.returnValue(of(completedResponse({ action: 'pre_renewal' })));
    begin('pre_renewal');
    component.renewalYears = 2; component.useCommonExpiration = true;
    component.expirationDate = '2028-09-29'; component.notes = '  Cliente confirmó  ';
    component.previewExecution(); component.confirmExecution(); fixture.detectChanges();
    expect(service.execute).toHaveBeenCalledOnceWith(response.id, {
      action: 'pre_renewal', years: 2, registrationDate: '2026-09-29', expirationDate: '2028-09-29', notes: 'Cliente confirmó',
    });
    expect(fixture.nativeElement.textContent).toContain('Renovación al contado registrada');
    expect(fixture.nativeElement.textContent).toContain('pendientes de facturación en Incosis');
  });

  it('does not send a hidden common date when per-device duration is selected', () => {
    begin(); component.expirationDate = '2030-01-01';
    component.previewExecution(); component.confirmExecution();
    expect(service.execute.calls.mostRecent().args[1].expirationDate).toBeUndefined();
  });

  it('rejects missing and impossible dates and duration outside 1 to 10 years', () => {
    begin();
    for (const date of ['', '2026-02-31', '2026-13-01', 'invalid']) {
      component.registrationDate = date;
      component.previewExecution(); component.confirmExecution();
      expect(component.executionError).toContain('fecha de registro válida');
      expect(component.canConfirmExecution).toBeFalse();
    }
    component.registrationDate = '2026-09-29'; component.useCommonExpiration = true;
    for (const date of ['', '2026-02-29']) {
      component.expirationDate = date; component.previewExecution();
      expect(component.executionError).toContain('vencimiento válido');
    }
    component.expirationDate = '2028-02-29';
    for (const years of [0, 11, 1.5]) {
      component.renewalYears = years; component.previewExecution();
      expect(component.executionError).toContain('entre 1 y 10');
    }
    component.renewalYears = 1; component.notes = 'a'.repeat(1001); component.previewExecution();
    expect(component.executionError).toContain('1000');
    expect(service.execute).not.toHaveBeenCalled();
    component.notes = ''; expect(component.canReviewExecution).toBeTrue();
  });

  it('does not offer any operation when the client declined every device', () => {
    service.getForClient.and.returnValue(of([{ ...response, decisions: response.decisions!.map(decision => ({ ...decision, renew: false })) }]));
    begin(); component.previewExecution(); component.confirmExecution();
    expect(component.action).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Renovar ( Facturación a crédito )');
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('requires all three permissions for non-root users and keeps the response readable', () => {
    for (const denied of ['processes.read', 'processes.create', 'devices.update']) {
      auth.hasPrivilege.and.callFake((module, action) => `${module}.${action}` !== denied);
      openResponse(); component.beginExecution('renewal'); fixture.detectChanges();
      expect(component.canProcess).toBeFalse();
      expect(component.action).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Toyota');
      expect(fixture.nativeElement.textContent).toContain('Para procesarla necesitas permisos');
    }
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('permits root users even without explicit privileges', () => {
    auth.hasPrivilege.and.returnValue(false);
    for (const root of [true, 'true']) {
      auth.getCurrentUser.and.returnValue({ root } as any);
      openResponse(); component.beginExecution('renewal');
      expect(component.canProcess).toBeTrue();
      expect(component.action).toBe('renewal');
      component.cancelExecution();
    }
  });

  it('blocks double submission, closing, switching response and other operations while processing', () => {
    const pending = new Subject<RenewalLinkSummary>(); service.execute.and.returnValue(pending);
    begin(); component.previewExecution(); component.confirmExecution();
    component.confirmExecution(); component.close(); component.backToResponses(); component.refresh(); component.generate(); component.revoke(active);
    component.selectResponse({ ...response, id: 'another-response' });
    expect(component.executing).toBeTrue(); expect(component.visible).toBeTrue();
    expect(component.responseVisible).toBeTrue();
    expect(component.selectedId).toBe(response.id);
    expect(service.execute).toHaveBeenCalledTimes(1);
    expect(service.getForClient).toHaveBeenCalledTimes(1);
    expect(service.create).not.toHaveBeenCalled(); expect(service.revoke).not.toHaveBeenCalled();
    pending.next(completedResponse()); component.close();
    expect(component.visible).toBeFalse();
  });

  it('shows per-device failures, locks parameters and excludes previous successes from the retry count', () => {
    const partial: RenewalLinkSummary = { ...response, decisions: [...response.decisions!, { deviceId: 'device-3', name: 'Nissan', imei: '789', renew: true }], execution: execution({
      status: 'partial', failed: 1, results: [
        { deviceId: 'device-1', status: 'succeeded', expirationDate: '2027-09-20' },
        { deviceId: 'device-3', status: 'failed', message: 'El vencimiento cambió desde la respuesta.' },
      ],
    }) };
    service.getForClient.and.returnValue(of([partial]));
    openResponse();
    expect(component.remainingCount).toBe(1); expect(component.actionLocked).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('El vencimiento cambió desde la respuesta.');
    expect((fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeTrue();
    component.beginExecution('pre_renewal'); expect(component.action).toBe('renewal');
    component.previewExecution(); component.confirmExecution();
    expect(service.execute).toHaveBeenCalledOnceWith(response.id, { action: 'renewal', years: 1, registrationDate: '2026-09-29' });
  });

  it('resumes a persisted processing execution with the same parameters after reload', () => {
    service.getForClient.and.returnValue(of([completedResponse({
      action: 'pre_renewal', status: 'processing', succeeded: 0, pending: 1, years: 3,
      expirationDate: '2030-01-01', notes: 'Retomar', results: [{ deviceId: 'device-1', status: 'pending' }],
    })]));
    openResponse();
    expect(component.canReviewExecution).toBeTrue();
    component.previewExecution(); component.confirmExecution();
    expect(service.execute).toHaveBeenCalledOnceWith(response.id, {
      action: 'pre_renewal', years: 3, registrationDate: '2026-09-29', expirationDate: '2030-01-01', notes: 'Retomar',
    });
  });

  it('retries an uncertain request identically and permits refreshing its stored result', () => {
    service.execute.and.returnValue(throwError(() => ({ status: 0 })));
    begin(); component.previewExecution(); component.confirmExecution();
    expect(component.executionError).toContain('No pudimos comprobar');
    expect(component.actionLocked).toBeTrue();
    component.beginExecution('pre_renewal'); expect(component.action).toBe('renewal');
    component.previewExecution(); component.confirmExecution();
    expect(service.execute.calls.argsFor(1)).toEqual(service.execute.calls.argsFor(0));
    service.getForClient.and.returnValue(of([completedResponse()])); component.refresh();
    expect(component.remainingCount).toBe(0); expect(component.executionError).toBe('');
    expect(component.canConfirmExecution).toBeFalse();
  });

  it('lets staff correct a request rejected before execution after refreshing the response', () => {
    service.execute.and.returnValue(throwError(() => ({ status: 400, error: { message: 'Fecha rechazada.' } })));
    begin(); component.previewExecution(); component.confirmExecution();
    expect(component.executionError).toBe('Fecha rechazada.');
    service.getForClient.and.returnValue(of([{ ...response, renewalMethod: 'cash' }]));
    component.refresh(); expect(component.actionLocked).toBeFalse();
    component.beginExecution('pre_renewal'); expect(component.action).toBe('pre_renewal');
  });

  it('cancels drafts without requests and clears them when selecting another response', () => {
    begin(); component.previewExecution(); component.cancelExecution();
    expect(component.action).toBeNull(); expect(service.execute).not.toHaveBeenCalled();
    component.beginExecution('renewal'); component.notes = 'Borrador';
    const other = { ...response, id: 'other-response' }; component.links.push(other);
    component.selectResponse(other);
    expect(component.action).toBeNull(); expect(component.notes).toBe('');
  });

  it('does not apply a late execution result after the client changes', () => {
    const pending = new Subject<RenewalLinkSummary>(); service.execute.and.returnValue(pending);
    const processed = spyOn(component.processed, 'emit');
    begin(); component.previewExecution(); component.confirmExecution();
    component.client = { id: 'other-client', label: 'Otro' }; service.getForClient.and.returnValue(of([]));
    component.ngOnChanges({ client: new SimpleChange(client, component.client, false) });
    pending.next(completedResponse());
    expect(component.links).toEqual([]); expect(processed).not.toHaveBeenCalled();
    expect(pending.observers.length).toBe(0);
    expect(component.responseVisible).toBeFalse();
  });

  it('opens an exclusive response modal from its list button with client details and totals', () => {
    open();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(element => element.textContent?.trim() === 'Ver respuesta')!;
    button.click(); fixture.detectChanges();
    const detail = fixture.nativeElement.querySelector('.process-renewal-response-dialog') as HTMLElement;
    expect(detail).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.p-dialog').length).toBe(1);
    expect(detail.textContent).toContain('Respuesta del cliente');
    expect(detail.textContent).toContain('Maria Garcia');
    expect(detail.textContent).toContain(client.email);
    expect(detail.textContent).toContain(client.phone);
    expect(detail.textContent).toContain('Respuesta confirmada');
    expect(detail.textContent).toContain('Enlace creado');
    expect(detail.textContent).toContain('Toyota');
    expect(detail.textContent).toContain('Honda');
    expect(Array.from(detail.querySelectorAll('.renewal-response-overview strong')).map(element => element.textContent?.trim())).toEqual(['2', '1', '1']);
    expect(detail.textContent).not.toContain('Generar enlace');
    expect(detail.textContent).not.toContain('Generar otro enlace');
    expect(detail.textContent).not.toContain('Copiar enlace');
    expect(detail.querySelector('.renewal-link-list')).toBeNull();
    expect(fixture.nativeElement.querySelector('#renewal-public-link')).toBeNull();
  });

  it('returns to the same list without closing, refetching or losing the generated link', () => {
    open(); component.selectResponse(response); fixture.detectChanges();
    const visibility = spyOn(component.visibleChange, 'emit');
    component.backToResponses(); fixture.detectChanges();
    expect(component.visible).toBeTrue(); expect(component.responseVisible).toBeFalse();
    expect(visibility).not.toHaveBeenCalled();
    expect(service.getForClient).toHaveBeenCalledTimes(1);
    expect(component.links).toEqual([active, response]);
    expect(fixture.nativeElement.querySelector('#renewal-public-link')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.process-renewal-response-dialog')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.p-dialog').length).toBe(1);
  });

  it('closes the whole flow from the response close control and reopens at the list', () => {
    openResponse();
    const visibility = spyOn(component.visibleChange, 'emit');
    component.onVisibleChange(false); fixture.detectChanges();
    expect(visibility).toHaveBeenCalledOnceWith(false);
    expect(component.visible).toBeFalse(); expect(component.responseVisible).toBeFalse();
    expect(fixture.nativeElement.querySelector('.p-dialog')).toBeNull();
    fixture.componentRef.setInput('visible', false); fixture.detectChanges();
    fixture.componentRef.setInput('visible', true); fixture.detectChanges();
    expect(component.responseVisible).toBeFalse(); expect(component.selectedLink).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('Ver respuesta');
  });

  it('keeps an uncertain operation and its retry parameters when returning to the same response', () => {
    service.execute.and.returnValue(throwError(() => ({ status: 0 })));
    begin(); component.previewExecution(); component.confirmExecution();
    const message = component.executionError;
    component.backToResponses(); component.selectResponse(response);
    expect(component.executionError).toBe(message);
    expect(component.actionLocked).toBeTrue();
    component.previewExecution(); component.confirmExecution();
    expect(service.execute.calls.argsFor(1)).toEqual(service.execute.calls.argsFor(0));
  });

  it('refreshes only the chosen response and never replaces a missing response with another one', () => {
    openResponse();
    service.getForClient.and.returnValue(of([{ ...response, id: 'other-response' }]));
    component.refresh(); fixture.detectChanges();
    expect(component.responseVisible).toBeFalse(); expect(component.selectedLink).toBeUndefined();
    expect(component.historyError).toContain('ya no está disponible');
    expect(fixture.nativeElement.querySelector('.process-renewal-response-dialog')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Ver respuesta');
    expect(service.getForClient.calls.mostRecent().args).toEqual([client.id]);
  });

  it('keeps the selected response open on refresh errors and lets staff retry', () => {
    openResponse();
    service.getForClient.and.returnValue(throwError(() => ({ status: 0 })));
    component.refresh(); fixture.detectChanges();
    expect(component.responseVisible).toBeTrue();
    expect(component.selectedLink?.id).toBe(response.id);
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar');
    service.getForClient.and.returnValue(of([completedResponse()])); component.refresh();
    expect(component.responseVisible).toBeTrue();
    expect(component.selectedLink?.execution?.status).toBe('completed');
    expect(component.historyError).toBe('');
  });

  it('does not open another client response or reuse contacts after the client changes', () => {
    openResponse();
    const other = { ...response, id: 'other-response', client: { id: 'client-2', name: 'OTRO CLIENTE' } };
    component.links.push(other);
    component.backToResponses(); component.selectResponse(other);
    expect(component.responseVisible).toBeFalse();
    expect(component.selectedId).toBe(response.id);
    component.selectedId = other.id;
    expect(component.selectedLink).toBeUndefined(); expect(component.responseClientContact).toBeNull();
    service.getForClient.and.returnValue(of([other]));
    component.client = { id: 'client-2', label: 'OTRO CLIENTE' };
    component.ngOnChanges({ client: new SimpleChange(client, component.client, false) });
    expect(component.responseVisible).toBeFalse();
    component.selectResponse(other); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Otro Cliente');
    expect(fixture.nativeElement.textContent).not.toContain(client.email);
    expect(fixture.nativeElement.textContent).not.toContain(client.phone);
  });

  it('does not start or confirm a renewal from the list view', () => {
    begin(); component.previewExecution(); component.backToResponses();
    component.confirmExecution();
    expect(component.canConfirmExecution).toBeFalse();
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('shows only pre-renewal for a cash client and rejects starting ordinary renewal', () => {
    service.getForClient.and.returnValue(of([{ ...response, renewalMethod: 'cash' }]));
    openResponse();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).map(button => button.textContent?.trim());
    expect(buttons).toContain('Renovar ( Facturación al contado )'); expect(buttons).not.toContain('Renovar ( Facturación a crédito )');
    expect(fixture.nativeElement.textContent).toContain('Renovar ( Facturación al contado )');
    component.beginExecution('renewal'); expect(component.action).toBeNull();
    component.beginExecution('pre_renewal'); expect(component.action).toBe('pre_renewal');
  });

  it('shows only renewal for a credit client and rejects starting pre-renewal', () => {
    openResponse();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).map(button => button.textContent?.trim());
    expect(buttons).toContain('Renovar ( Facturación a crédito )'); expect(buttons).not.toContain('Renovar ( Facturación al contado )');
    expect(fixture.nativeElement.textContent).toContain('Renovar ( Facturación a crédito )');
    component.beginExecution('pre_renewal'); expect(component.action).toBeNull();
  });

  it('blocks new operations when the method is missing, invalid or accompanied by an integration error', () => {
    openResponse();
    for (const config of [
      { renewalMethod: undefined }, { renewalMethod: null }, { renewalMethod: 'invalid' as any },
      { renewalMethod: 'cash' as const, renewalMethodError: 'No se pudo consultar Incosis.' },
    ]) {
      component.links = [{ ...response, ...config }]; fixture.detectChanges();
      expect(component.permittedNewAction).toBeNull();
      component.beginExecution('renewal'); component.beginExecution('pre_renewal');
      expect(component.action).toBeNull();
      expect(fixture.nativeElement.querySelector('.renewal-method-info')?.textContent).toBeTruthy();
    }
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('shows method loading and permits the new action after a successful refresh', () => {
    const pending = new Subject<RenewalLinkSummary[]>();
    openResponse(); service.getForClient.and.returnValue(pending); component.refresh(); fixture.detectChanges();
    expect(component.permittedNewAction).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Consultando el método');
    component.beginExecution('renewal'); expect(component.action).toBeNull();
    pending.next([{ ...response, renewalMethod: 'cash' }]);
    component.beginExecution('pre_renewal'); expect(component.action).toBe('pre_renewal');
  });

  it('does not use a previous method after refreshing the response fails', () => {
    openResponse(); service.getForClient.and.returnValue(throwError(() => ({ status: 503 })));
    component.refresh(); component.beginExecution('renewal');
    expect(component.permittedNewAction).toBeNull(); expect(component.action).toBeNull();
    expect(component.renewalMethodMessage).toContain('No se pudo actualizar');
  });

  it('preserves a started operation when the client method changes or Incosis becomes unavailable', () => {
    for (const method of ['cash' as const, null]) {
      service.getForClient.and.returnValue(of([completedResponse({
        status: 'partial', succeeded: 0, failed: 1, results: [{ deviceId: 'device-1', status: 'failed', message: 'Reintentar' }],
      })]));
      openResponse();
      component.links = [{ ...component.selectedLink!, renewalMethod: method, renewalMethodError: method ? undefined : 'Incosis no disponible.' }];
      expect(component.action).toBe('renewal'); expect(component.canReviewExecution).toBeTrue();
      component.previewExecution(); component.confirmExecution();
      expect(service.execute.calls.mostRecent().args[1].action).toBe('renewal');
      component.close(); fixture.componentRef.setInput('visible', false); fixture.detectChanges();
    }
    expect(service.execute).toHaveBeenCalledTimes(2);
  });

  it('preserves an uncertain attempt and its exact retry payload after the returned method changes', () => {
    service.execute.and.returnValue(throwError(() => ({ status: 0 })));
    begin(); component.previewExecution(); component.confirmExecution();
    service.getForClient.and.returnValue(of([{ ...response, renewalMethod: 'cash' }])); component.refresh();
    expect(component.actionLocked).toBeTrue(); expect(component.action).toBe('renewal');
    expect(component.executionError).toContain('No pudimos comprobar');
    component.previewExecution(); component.confirmExecution();
    expect(service.execute.calls.argsFor(1)).toEqual(service.execute.calls.argsFor(0));
  });

  it('rechecks the method before confirming a draft that has not started', () => {
    begin(); component.previewExecution();
    component.links = [{ ...response, renewalMethod: 'cash' }];
    expect(component.canConfirmExecution).toBeFalse();
    component.confirmExecution(); expect(service.execute).not.toHaveBeenCalled();
  });

  it('previews current server expirations instead of the link snapshot and preserves calendar dates', () => {
    service.preview.and.returnValue(of(previewItems({
      deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal',
      currentExpirationDate: '2028-02-29T00:00:00.000Z', expirationDate: '2029-02-28T00:00:00.000Z',
      requestedExpirationDate: '2029-02-28T00:00:00.000Z',
    }, {
      deviceId: 'device-2', renew: false, canExecute: false, effect: 'unchanged',
      currentExpirationDate: '2031-12-31', expirationDate: '2031-12-31',
    })));
    begin(); fixture.detectChanges();
    expect(service.preview).toHaveBeenCalledOnceWith(response.id, { action: 'renewal', years: 1, registrationDate: jasmine.any(String) });
    expect(component.hasCurrentPreview).toBeTrue();
    expect(deviceRow('Toyota').textContent).toContain('29/02/2028');
    expect(deviceRow('Toyota').textContent).toContain('28/02/2029');
    expect(currentExpirationText('Toyota')).toBe('29/02/2028');
    expect(deviceRow('Honda').textContent).toContain('31/12/2031');
    expect(service.execute).not.toHaveBeenCalled();
    expect(component.confirmationVisible).toBeFalse();
  });

  it('shows no current expiration when the server has none instead of falling back to an old snapshot', () => {
    service.preview.and.returnValue(of(previewItems({
      deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal', currentExpirationDate: null, expirationDate: '2029-09-29',
    })));
    begin(); fixture.detectChanges();
    const row = deviceRow('Toyota');
    expect(currentExpirationText('Toyota')).toBe('Sin fecha');
    expect(row.textContent).toContain('29/09/2029');
  });

  it('uses Dominican calendar dates for server instants and preserves legacy UTC-midnight dates', () => {
    service.preview.and.returnValue(of(previewItems({
      deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal',
      currentExpirationDate: '2028-03-01T03:59:59.000Z', expirationDate: '2029-03-01T03:59:59.000Z',
      requestedExpirationDate: '2032-02-29T00:00:00.000Z',
    })));
    begin(); fixture.detectChanges();
    expect(currentExpirationText('Toyota')).toBe('29/02/2028');
    const outcome = deviceRow('Toyota').querySelector('.renewal-preview-outcome')!;
    expect(outcome.textContent).toContain('28/02/2029');
    expect(outcome.textContent).toContain('29/02/2032');
  });

  it('reloads a fresh preview before opening confirmation and cannot execute while it is pending', () => {
    begin();
    const pending = new Subject<RenewalLinkPreview>();
    service.preview.and.returnValue(pending);
    component.previewExecution(); component.previewExecution(); component.confirmExecution(); fixture.detectChanges();
    expect(service.preview).toHaveBeenCalledTimes(2);
    expect(component.previewLoading).toBeTrue();
    expect(component.confirmationVisible).toBeFalse();
    expect(component.canConfirmExecution).toBeFalse();
    expect(service.execute).not.toHaveBeenCalled();
    pending.next(previewItems({
      deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal',
      currentExpirationDate: '2029-04-05', expirationDate: '2030-04-05',
    }));
    fixture.detectChanges();
    expect(component.previewLoading).toBeFalse();
    expect(component.confirmationVisible).toBeTrue();
    expect(component.canConfirmExecution).toBeTrue();
    expect(deviceRow('Toyota').textContent).toContain('05/04/2029');
    expect(deviceRow('Toyota').textContent).toContain('05/04/2030');
    component.confirmExecution();
    expect(service.execute).toHaveBeenCalledOnceWith(response.id, service.preview.calls.mostRecent().args[1]);
  });

  it('refreshes the table through duration and common-date controls with the exact preview payload', async () => {
    begin(); fixture.detectChanges(); await fixture.whenStable();
    const duration = fixture.nativeElement.querySelector('#bulk-renewal-years') as HTMLSelectElement;
    duration.selectedIndex = 2;
    duration.dispatchEvent(new Event('change'));
    fixture.detectChanges(); await fixture.whenStable();
    expect(component.renewalYears).toBe(3);
    expect(service.preview.calls.mostRecent().args[1]).toEqual({ action: 'renewal', years: 3, registrationDate: '2026-09-29' });
    const common = fixture.nativeElement.querySelector('#bulk-common-expiration') as HTMLInputElement;
    common.checked = true; common.dispatchEvent(new Event('change'));
    fixture.detectChanges(); await fixture.whenStable();
    expect(component.hasCurrentPreview).toBeFalse();
    const date = fixture.nativeElement.querySelector('#bulk-expiration-date') as HTMLInputElement;
    date.value = '2032-02-29'; date.dispatchEvent(new Event('input'));
    fixture.detectChanges(); await fixture.whenStable();
    expect(service.preview.calls.mostRecent().args[1]).toEqual({
      action: 'renewal', years: 3, registrationDate: '2026-09-29', expirationDate: '2032-02-29',
    });
    expect(deviceRow('Toyota').textContent).toContain('29/02/2032');
    component.previewExecution();
    const reviewedRequest = service.preview.calls.mostRecent().args[1];
    component.confirmExecution();
    expect(service.execute.calls.mostRecent().args[1]).toEqual(reviewedRequest);
  });

  it('invalidates confirmation for changed options and ignores a superseded preview', () => {
    begin(); component.previewExecution();
    const stale = new Subject<RenewalLinkPreview>();
    const latest = new Subject<RenewalLinkPreview>();
    service.preview.and.returnValues(stale, latest);
    component.renewalYears = 2; component.onExecutionOptionsChange();
    expect(component.confirmationVisible).toBeFalse();
    expect(component.hasCurrentPreview).toBeFalse();
    component.renewalYears = 3; component.onExecutionOptionsChange();
    expect(stale.observers.length).toBe(0);
    latest.next(previewItems({ deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal', expirationDate: '2030-09-20' }));
    stale.next(previewItems({ deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal', expirationDate: '2029-09-20' }));
    fixture.detectChanges();
    expect(component.previewFor('device-1')?.expirationDate).toBe('2030-09-20');
    expect(component.hasCurrentPreview).toBeTrue();
    expect(component.confirmationVisible).toBeFalse();
    component.confirmExecution(); expect(service.execute).not.toHaveBeenCalled();
  });

  it('rejects a reviewed payload when draft fields change even without a template event', () => {
    begin(); component.previewExecution();
    expect(component.hasCurrentPreview).toBeTrue();
    component.notes = 'Una observación distinta';
    expect(component.hasCurrentPreview).toBeFalse();
    component.confirmExecution(); expect(service.execute).not.toHaveBeenCalled();
    component.onExecutionOptionsChange(); component.previewExecution(); component.confirmExecution();
    expect(service.execute.calls.mostRecent().args[1].notes).toBe('Una observación distinta');
  });

  it('separates the cash proposal from the expiration that stays unchanged until Incosis invoices', () => {
    service.preview.and.returnValue(of(previewItems({
      deviceId: 'device-1', renew: true, canExecute: true, effect: 'pre_renewal',
      currentExpirationDate: '2025-09-20', expirationDate: '2025-09-20', requestedExpirationDate: '2028-09-20',
      message: 'El vencimiento cambia al facturar en Incosis.',
    })));
    begin('pre_renewal'); fixture.detectChanges();
    const row = deviceRow('Toyota');
    expect(row.textContent).toContain('20/09/2025');
    expect(row.textContent).toContain('20/09/2028');
    expect(row.textContent).toContain('Incosis');
    expect(component.previewFor('device-1')?.expirationDate).toBe('2025-09-20');
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('preserves declined and completed rows while previewing only the remaining work', () => {
    const partial = { ...completedResponse({ status: 'partial', failed: 1 }), decisions: [
      ...response.decisions!, { deviceId: 'device-3', name: 'Nissan', imei: '789', renew: true },
    ] };
    service.getForClient.and.returnValue(of([partial]));
    service.preview.and.returnValue(of(previewItems({
      deviceId: 'device-1', renew: true, canExecute: false, effect: 'completed',
      currentExpirationDate: '2027-09-20', expirationDate: '2027-09-20', message: 'Ya completado. Se conserva.',
    }, {
      deviceId: 'device-2', renew: false, canExecute: false, effect: 'unchanged',
      currentExpirationDate: '2031-06-15', expirationDate: '2031-06-15',
    }, {
      deviceId: 'device-3', renew: true, canExecute: true, effect: 'renewal',
      currentExpirationDate: '2026-08-10', expirationDate: '2027-08-10',
    })));
    openResponse(); component.previewExecution(); fixture.detectChanges();
    expect(component.remainingCount).toBe(1);
    expect(deviceRow('Toyota').textContent).toContain('20/09/2027');
    expect(deviceRow('Toyota').textContent).not.toContain('20/09/2028');
    expect(deviceRow('Honda').textContent).toContain('15/06/2031');
    expect(deviceRow('Honda').textContent).not.toContain('15/06/2032');
    expect(deviceRow('Nissan').textContent).toContain('10/08/2027');
    expect(component.canConfirmExecution).toBeTrue();
    component.confirmExecution();
    expect(service.execute.calls.mostRecent().args[1]).toEqual({ action: 'renewal', years: 1, registrationDate: '2026-09-29' });
  });

  it('blocks confirmation when the preview has no executable devices and shows the server reason', () => {
    service.preview.and.returnValue(of(previewItems({
      deviceId: 'device-1', renew: true, canExecute: false, effect: 'unavailable', message: 'El dispositivo ya no pertenece al cliente.',
    }, { deviceId: 'device-2', renew: false, canExecute: false, effect: 'unchanged' })));
    begin(); component.previewExecution(); component.confirmExecution(); fixture.detectChanges();
    expect(component.canConfirmExecution).toBeFalse();
    expect(currentExpirationText('Toyota')).toBe('No disponible');
    expect(deviceRow('Toyota').textContent).toContain('El dispositivo ya no pertenece al cliente.');
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('rejects an incomplete preview even when one returned device is executable', () => {
    service.preview.and.returnValue(of({ items: [{
      deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal', expirationDate: '2027-09-20',
    }] }));
    begin(); component.previewExecution(); component.confirmExecution(); fixture.detectChanges();
    expect(component.previewError).toContain('incompleta');
    expect(component.hasCurrentPreview).toBeFalse();
    expect(component.canConfirmExecution).toBeFalse();
    expect(component.confirmationVisible).toBeFalse();
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('clears an earlier preview on failure and permits a fresh retry without executing stale dates', () => {
    begin();
    service.preview.and.returnValue(throwError(() => ({ status: 503, error: { message: 'No se pudo consultar el vencimiento actual.' } })));
    component.previewExecution(); fixture.detectChanges();
    expect(component.previewError).toContain('No se pudo consultar el vencimiento actual.');
    expect(component.hasCurrentPreview).toBeFalse();
    expect(component.previewLoading).toBeFalse();
    expect(component.confirmationVisible).toBeFalse();
    component.confirmExecution(); expect(service.execute).not.toHaveBeenCalled();
    service.preview.and.returnValue(of(previewItems({ deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal', expirationDate: '2030-01-01' })));
    component.previewExecution();
    expect(component.previewError).toBe('');
    expect(component.canConfirmExecution).toBeTrue();
    expect(component.confirmationVisible).toBeTrue();
  });

  it('cancels previews when returning to the list and requires a new review when reopening', () => {
    begin();
    const pending = new Subject<RenewalLinkPreview>(); service.preview.and.returnValue(pending);
    component.previewExecution(); component.backToResponses();
    expect(pending.observers.length).toBe(0);
    pending.next(previewItems({ deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal', expirationDate: '2040-01-01' }));
    expect(component.responseVisible).toBeFalse();
    expect(component.confirmationVisible).toBeFalse();
    expect(component.hasCurrentPreview).toBeFalse();
    component.selectResponse(response); component.confirmExecution();
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('ignores preview responses after the client changes', () => {
    begin();
    const pending = new Subject<RenewalLinkPreview>(); service.preview.and.returnValue(pending);
    component.previewExecution();
    component.client = { id: 'client-2', label: 'Otro' }; service.getForClient.and.returnValue(of([]));
    component.ngOnChanges({ client: new SimpleChange(client, component.client, false) });
    pending.next(previewItems({ deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal', expirationDate: '2040-01-01' }));
    expect(pending.observers.length).toBe(0);
    expect(component.executionPreview).toBeNull();
    expect(component.confirmationVisible).toBeFalse();
    expect(component.previewLoading).toBeFalse();
    expect(component.links).toEqual([]);
    component.close(); expect(service.execute).not.toHaveBeenCalled();
  });

  it('cancels a pending preview on close and does not restore confirmation from its result', () => {
    begin();
    const pending = new Subject<RenewalLinkPreview>(); service.preview.and.returnValue(pending);
    component.previewExecution(); component.close();
    expect(pending.observers.length).toBe(0);
    pending.next(previewItems({ deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal', expirationDate: '2040-01-01' }));
    expect(component.visible).toBeFalse();
    expect(component.executionPreview).toBeNull();
    expect(component.previewLoading).toBeFalse();
    expect(component.confirmationVisible).toBeFalse();
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('discards a pending preview when switching responses and never carries its dates into the next response', () => {
    begin();
    const pending = new Subject<RenewalLinkPreview>(); service.preview.and.returnValue(pending);
    component.previewExecution();
    const nextResponse = { ...response, id: 'response-2' };
    component.links.push(nextResponse); component.selectResponse(nextResponse);
    expect(pending.observers.length).toBe(0);
    pending.error({ status: 500, error: { message: 'Error anterior' } });
    expect(component.selectedId).toBe(nextResponse.id);
    expect(component.action).toBeNull();
    expect(component.executionPreview).toBeNull();
    expect(component.previewError).toBe('');
    expect(component.confirmationVisible).toBeFalse();
    expect(service.execute).not.toHaveBeenCalled();
  });

  it('unsubscribes from previews on destroy without emitting completion', () => {
    begin();
    const pending = new Subject<RenewalLinkPreview>(); service.preview.and.returnValue(pending);
    const processed = spyOn(component.processed, 'emit');
    component.previewExecution(); fixture.destroy();
    expect(pending.observers.length).toBe(0);
    pending.next(previewItems({ deviceId: 'device-1', renew: true, canExecute: true, effect: 'renewal' }));
    expect(processed).not.toHaveBeenCalled();
    expect(service.execute).not.toHaveBeenCalled();
  });
});

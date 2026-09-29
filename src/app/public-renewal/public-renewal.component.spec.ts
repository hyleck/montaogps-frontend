import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { AppRoutingModule } from '../app-routing.module';
import { PublicRenewalInfo, RenewalLinksService } from '../core/services/renewal-links.service';
import { PublicRenewalComponent } from './public-renewal.component';

describe('PublicRenewalComponent', () => {
  let fixture: ComponentFixture<PublicRenewalComponent>;
  let component: PublicRenewalComponent;
  let service: jasmine.SpyObj<RenewalLinksService>;
  let params: BehaviorSubject<ParamMap>;
  let meta: Meta;
  let originalReferrer: string | null;
  const info: PublicRenewalInfo = {
    client: { name: 'MARÍA PÉREZ' },
    expiresAt: '2026-10-31T18:00:00Z',
    status: 'active',
    devices: [
      { id: 'device-1', name: 'Camión Blanco', imei: '111111111111111', plate: 'L123456', expirationDate: '2026-08-26T00:00:00.000Z' },
      { id: 'device-2', name: 'Toyota Roja', imei: '222222222222222', expirationDate: '2027-10-01' },
    ],
  };
  const submitted: PublicRenewalInfo = {
    ...info,
    status: 'submitted',
    submittedAt: '2026-09-29T18:25:00Z',
    devices: info.devices.map(device => ({ ...device, renew: false })),
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj('RenewalLinksService', ['getPublic', 'submitPublic']);
    service.getPublic.and.returnValue(of(info));
    service.submitPublic.and.returnValue(of(submitted));
    params = new BehaviorSubject(convertToParamMap({ token: 'token-one' }));
    await TestBed.configureTestingModule({
      imports: [PublicRenewalComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
        { provide: RenewalLinksService, useValue: service },
      ],
    }).compileComponents();
    meta = TestBed.inject(Meta);
    originalReferrer = meta.getTag('name="referrer"')?.content ?? null;
    fixture = TestBed.createComponent(PublicRenewalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    if (originalReferrer === null) meta.removeTag('name="referrer"');
    else meta.updateTag({ name: 'referrer', content: originalReferrer });
  });

  function render(): void {
    fixture.detectChanges();
  }

  function radio(deviceId: string, renew: boolean): HTMLInputElement {
    return fixture.nativeElement.querySelectorAll(`[data-device-id="${deviceId}"] input[type="radio"]`)[renew ? 0 : 1];
  }

  it('shows a loading state, then all current and expired devices with no decisions preselected', () => {
    const response = new Subject<PublicRenewalInfo>();
    service.getPublic.and.returnValue(response);
    render();
    expect(fixture.nativeElement.textContent).toContain('Cargando tu solicitud');
    expect(service.getPublic).toHaveBeenCalledOnceWith('token-one');
    response.next(info);
    render();
    expect(fixture.nativeElement.textContent).toContain('María Pérez');
    expect(fixture.nativeElement.querySelectorAll('.renewal-device').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('26/08/2026');
    expect(fixture.nativeElement.textContent).toContain('01/10/2027');
    expect(component.renewCount).toBe(0);
    expect(component.noRenewCount).toBe(0);
    expect(component.undecidedCount).toBe(2);
    expect([...fixture.nativeElement.querySelectorAll('input[type="radio"]')].every((input: any) => !input.checked)).toBeTrue();
    expect((fixture.nativeElement.querySelector('.renewal-submit') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('does not initialize active decisions from optional response flags', () => {
    service.getPublic.and.returnValue(of({ ...info, devices: info.devices.map(device => ({ ...device, renew: false })) }));
    render();
    expect(component.noRenewCount).toBe(0);
    expect(component.undecidedCount).toBe(2);
  });

  it('shows the saved expiration range even for an empty list, independently of the link validity', () => {
    service.getPublic.and.returnValue(of({ ...info, devices: [],
      expirationFilter: { mode: 'range', dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    }));
    render();
    const range = fixture.nativeElement.querySelector('.renewal-range').textContent;
    expect(range).toContain('Del 01/09/2026 al 30/09/2026, ambas fechas incluidas');
    expect(range).not.toContain('31/10/2026');
    expect(fixture.nativeElement.textContent).toContain('cliente y sus subcuentas');
    expect(fixture.nativeElement.querySelector('.renewal-footer').textContent).toContain('31/10/2026');
  });

  it('keeps the saved range visible after the client confirms their response', () => {
    const expirationFilter = { mode: 'range' as const, dateFrom: '2026-08-01', dateTo: '2027-10-31' };
    service.getPublic.and.returnValue(of({ ...info, expirationFilter }));
    service.submitPublic.and.returnValue(of({ ...submitted, expirationFilter }));
    render(); component.selectAll(false); component.confirmSelection(); render();
    expect(component.submitted).toBeTrue();
    expect(fixture.nativeElement.querySelector('.renewal-range').textContent).toContain('Del 01/08/2026 al 31/10/2027');
  });

  for (const example of [
    { filter: { mode: 'range' as const, dateFrom: '2026-09-01' }, label: 'Desde el 01/09/2026, inclusive' },
    { filter: { mode: 'range' as const, dateTo: '2026-09-30' }, label: 'Hasta el 30/09/2026, inclusive' },
    { filter: { mode: 'expired' as const, asOf: '2026-09-29' }, label: 'Vencidos antes del 29/09/2026' },
  ]) {
    it(`shows the filter accurately: ${example.label}`, () => {
      service.getPublic.and.returnValue(of({ ...info, expirationFilter: example.filter }));
      render();
      expect(fixture.nativeElement.querySelector('.renewal-range').textContent).toContain(example.label);
    });
  }

  it('does not infer a range from device dates or link validity in older links', () => {
    render();
    const range = fixture.nativeElement.querySelector('.renewal-range').textContent;
    expect(range).toContain('Sin rango de vencimiento registrado');
    expect(range).not.toContain('26/08/2026');
    expect(range).not.toContain('31/10/2026');
  });

  it('records each explicit radio choice and enables confirmation only when every device is decided', () => {
    render();
    radio('device-1', true).click();
    render();
    expect(component.renewCount).toBe(1);
    expect(component.undecidedCount).toBe(1);
    component.confirmSelection();
    expect(service.submitPublic).not.toHaveBeenCalled();
    radio('device-2', false).click();
    render();
    expect(component.renewCount).toBe(1);
    expect(component.noRenewCount).toBe(1);
    expect(component.undecidedCount).toBe(0);
    expect((fixture.nativeElement.querySelector('.renewal-submit') as HTMLButtonElement).disabled).toBeFalse();
    radio('device-1', false).click();
    expect(component.noRenewCount).toBe(2);
    expect(component.renewCount).toBe(0);
  });

  it('preserves hidden choices while searching by name, IMEI or plate', () => {
    render();
    component.setDecision('device-1', true);
    component.query = 'toyota';
    render();
    expect(fixture.nativeElement.querySelectorAll('.renewal-device').length).toBe(1);
    expect(component.filteredDevices[0].id).toBe('device-2');
    expect(component.renewCount).toBe(1);
    component.setDecision('device-2', false);
    component.query = 'camion';
    expect(component.filteredDevices.map(device => device.id)).toEqual(['device-1']);
    component.query = 'L123456';
    expect(component.filteredDevices.map(device => device.id)).toEqual(['device-1']);
    component.query = '222222';
    expect(component.filteredDevices.map(device => device.id)).toEqual(['device-2']);
    component.query = '';
    render();
    expect(radio('device-1', true).checked).toBeTrue();
    expect(radio('device-2', false).checked).toBeTrue();
    expect(component.canSubmit).toBeTrue();
  });

  it('applies clearly labeled bulk actions to all devices, including hidden rows', () => {
    render();
    component.query = 'Toyota';
    render();
    expect(fixture.nativeElement.textContent).toContain('incluyen los dispositivos ocultos');
    const actions: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.renewal-bulk button');
    expect(actions[0].textContent).toContain('Renovar todos');
    expect(actions[1].textContent).toContain('No renovar ninguno');
    actions[0].click();
    expect(component.renewCount).toBe(2);
    actions[1].click();
    expect(component.noRenewCount).toBe(2);
    expect(component.canSubmit).toBeTrue();
  });

  it('allows every device to be marked No renovar and shows the confirmed selection and date', () => {
    render();
    component.selectAll(false);
    render();
    (fixture.nativeElement.querySelector('.renewal-submit') as HTMLButtonElement).click();
    render();
    expect(service.submitPublic).toHaveBeenCalledOnceWith('token-one', [
      { deviceId: 'device-1', renew: false }, { deviceId: 'device-2', renew: false },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Recibimos tu selección');
    expect(fixture.nativeElement.textContent).toContain('29/09/2026');
    expect(component.submitted).toBeTrue();
    expect(fixture.nativeElement.querySelectorAll('input[type="radio"]').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.renewal-submit')).toBeNull();
    expect(component.noRenewCount).toBe(2);
  });

  it('locks submissions and edits until the pending confirmation finishes', () => {
    const response = new Subject<PublicRenewalInfo>();
    service.submitPublic.and.returnValue(response);
    render();
    component.selectAll(true);
    component.confirmSelection();
    component.confirmSelection();
    component.setDecision('device-1', false);
    component.selectAll(false);
    render();
    expect(service.submitPublic).toHaveBeenCalledTimes(1);
    expect(component.submitting).toBeTrue();
    expect(component.renewCount).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Confirmando selección');
    expect((fixture.nativeElement.querySelector('.renewal-submit') as HTMLButtonElement).disabled).toBeTrue();
    expect([...fixture.nativeElement.querySelectorAll('fieldset')].every((fieldset: any) => fieldset.disabled)).toBeTrue();
    response.next({ ...submitted, devices: info.devices.map(device => ({ ...device, renew: true })) });
    expect(component.submitting).toBeFalse();
    expect(component.submitted).toBeTrue();
  });

  it('loads an already submitted link as read-only and rejects further editing or submission', () => {
    service.getPublic.and.returnValue(of({ ...submitted, devices: [{ ...info.devices[0], renew: true }, { ...info.devices[1], renew: false }] }));
    render();
    component.selectAll(false);
    component.setDecision('device-1', false);
    component.confirmSelection();
    expect(component.renewCount).toBe(1);
    expect(component.noRenewCount).toBe(1);
    expect(fixture.nativeElement.querySelector('.renewal-bulk')).toBeNull();
    expect(fixture.nativeElement.querySelector('.renewal-submit')).toBeNull();
    expect(service.submitPublic).not.toHaveBeenCalled();
  });

  it('shows network load failures and retries without requiring authentication', () => {
    service.getPublic.and.returnValues(throwError(() => ({ status: 0 })), of(info));
    render();
    expect(fixture.nativeElement.textContent).toContain('Revisa tu conexión');
    expect(fixture.nativeElement.querySelector('.renewal-device')).toBeNull();
    (fixture.nativeElement.querySelector('.renewal-state button') as HTMLButtonElement).click();
    render();
    expect(service.getPublic).toHaveBeenCalledTimes(2);
    expect(component.info).toEqual(info);
    expect(component.loadError).toBe('');
  });

  it('explains invalid, expired and revoked links without exposing backend errors', () => {
    service.getPublic.and.returnValues(
      throwError(() => ({ status: 404, error: { message: 'sensitive error' } })),
      throwError(() => ({ status: 410 })),
      throwError(() => ({ status: 403 })),
    );
    render();
    expect(fixture.nativeElement.textContent).toContain('Enlace no disponible');
    expect(fixture.nativeElement.textContent).not.toContain('sensitive error');
    component.reload();
    expect(component.loadError).toContain('venció o fue revocado');
    component.reload();
    expect(component.loadError).toContain('Solicita un nuevo enlace');
    expect(component.info).toBeNull();
  });

  it('requires refreshing after a conflict and resets choices for the refreshed device list', () => {
    const changed: PublicRenewalInfo = { ...info, devices: [info.devices[0], { id: 'device-3', name: 'Nueva camioneta', imei: '333333333333333' }] };
    service.getPublic.and.returnValues(of(info), of(changed));
    service.submitPublic.and.returnValue(throwError(() => ({ status: 409 })));
    render();
    component.selectAll(true);
    component.confirmSelection();
    render();
    expect(component.requiresRefresh).toBeTrue();
    expect(component.canSubmit).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('estado del enlace cambió');
    component.selectAll(false);
    component.confirmSelection();
    expect(component.renewCount).toBe(2);
    expect(service.submitPublic).toHaveBeenCalledTimes(1);
    (fixture.nativeElement.querySelector('.renewal-notice--warning button') as HTMLButtonElement).click();
    render();
    expect(component.devices.map(device => device.id)).toEqual(['device-1', 'device-3']);
    expect(component.undecidedCount).toBe(2);
    expect(component.refreshNotice).toContain('Lista actualizada');
    expect(component.requiresRefresh).toBeFalse();
    expect(component.canSubmit).toBeFalse();
  });

  it('retains an all-No selection after a network failure and permits a retry', () => {
    service.submitPublic.and.returnValues(throwError(() => ({ status: 0 })), of(submitted));
    render();
    component.selectAll(false);
    component.confirmSelection();
    expect(component.submitError).toContain('No pudimos comprobar si tu selección se guardó');
    expect(component.noRenewCount).toBe(2);
    expect(component.canSubmit).toBeTrue();
    component.confirmSelection();
    expect(service.submitPublic).toHaveBeenCalledTimes(2);
    expect(component.submitted).toBeTrue();
  });

  it('can refresh after an uncertain submission and discover it was already confirmed', () => {
    service.submitPublic.and.returnValue(throwError(() => ({ status: 0 })));
    service.getPublic.and.returnValues(of(info), of(submitted));
    render();
    component.selectAll(false);
    component.confirmSelection();
    component.reload();
    render();
    expect(component.submitted).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Recibimos tu selección');
    expect(component.canSubmit).toBeFalse();
  });

  it('removes the device list when a token expires or is revoked during submission', () => {
    service.submitPublic.and.returnValue(throwError(() => ({ status: 410 })));
    render();
    component.selectAll(true);
    component.confirmSelection();
    render();
    expect(component.info).toBeNull();
    expect(fixture.nativeElement.querySelector('.renewal-device')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('venció o fue revocado');
  });

  it('cancels old token loads and ignores their responses when the URL token changes', () => {
    const old = new Subject<PublicRenewalInfo>();
    const current = new Subject<PublicRenewalInfo>();
    service.getPublic.and.returnValues(old, current);
    render();
    expect(old.observed).toBeTrue();
    params.next(convertToParamMap({ token: 'token-two' }));
    expect(old.observed).toBeFalse();
    old.next(submitted);
    expect(component.info).toBeNull();
    current.next({ ...info, client: { name: 'OTRO CLIENTE' } });
    expect(component.info?.client.name).toBe('OTRO CLIENTE');
    expect(component.submitted).toBeFalse();
    expect(service.getPublic.calls.mostRecent().args).toEqual(['token-two']);
  });

  it('cancels old token submissions and clears the previous account decisions on a new token', () => {
    const pending = new Subject<PublicRenewalInfo>();
    service.submitPublic.and.returnValue(pending);
    render();
    component.selectAll(false);
    component.confirmSelection();
    params.next(convertToParamMap({ token: 'token-two' }));
    expect(pending.observed).toBeFalse();
    expect(component.noRenewCount).toBe(0);
    expect(component.undecidedCount).toBe(2);
    expect(component.submitting).toBeFalse();
    pending.next(submitted);
    expect(component.submitted).toBeFalse();
    component.selectAll(true);
    component.confirmSelection();
    expect(service.submitPublic.calls.mostRecent().args[0]).toBe('token-two');
  });

  it('unsubscribes route, load and submit requests when destroyed', () => {
    const pendingLoad = new Subject<PublicRenewalInfo>();
    const pendingSubmit = new Subject<PublicRenewalInfo>();
    service.getPublic.and.returnValue(pendingLoad);
    service.submitPublic.and.returnValue(pendingSubmit);
    render();
    pendingLoad.next(info);
    component.selectAll(true);
    component.confirmSelection();
    fixture.destroy();
    expect(pendingLoad.observed).toBeFalse();
    expect(pendingSubmit.observed).toBeFalse();
    params.next(convertToParamMap({ token: 'ignored' }));
    expect(service.getPublic).toHaveBeenCalledTimes(1);
    pendingSubmit.next(submitted);
    expect(component.submitted).toBeFalse();
  });

  it('handles empty lists, no search results and missing dates without submitting an empty decision list', () => {
    service.getPublic.and.returnValues(of({ ...info, devices: [] }), of({ ...info, devices: [{ id: 'no-date', name: 'Vehículo', imei: '000' }] }));
    render();
    expect(fixture.nativeElement.textContent).toContain('No hay dispositivos disponibles');
    component.confirmSelection();
    expect(service.submitPublic).not.toHaveBeenCalled();
    component.reload();
    render();
    expect(fixture.nativeElement.textContent).toContain('Sin fecha disponible');
    component.query = 'absent';
    render();
    expect(fixture.nativeElement.textContent).toContain('No hay resultados');
    expect(component.undecidedCount).toBe(1);
    (fixture.nativeElement.querySelector('.renewal-empty button') as HTMLButtonElement).click();
    expect(component.query).toBe('');
  });

  it('does not call the backend for a missing token or for an unknown device decision', () => {
    params.next(convertToParamMap({}));
    render();
    expect(service.getPublic).not.toHaveBeenCalled();
    expect(component.loadErrorTitle).toBe('Enlace no disponible');
    params.next(convertToParamMap({ token: 'valid' }));
    component.setDecision('not-in-list', true);
    expect(component.renewCount).toBe(0);
    expect(component.undecidedCount).toBe(2);
  });

  it('blocks replay and indexing, avoids referrer sharing and restores previous metadata when leaving', () => {
    meta.updateTag({ name: 'referrer', content: 'same-origin' });
    const previousRobots = meta.getTag('name="robots"')?.content ?? null;
    meta.updateTag({ name: 'robots', content: 'index,follow' });
    render();
    expect(meta.getTag('name="referrer"')?.content).toBe('no-referrer');
    expect(meta.getTag('name="robots"')?.content).toBe('noindex,nofollow');
    expect(fixture.nativeElement.querySelector('main').hasAttribute('data-replay-block')).toBeTrue();
    fixture.destroy();
    expect(meta.getTag('name="referrer"')?.content).toBe('same-origin');
    expect(meta.getTag('name="robots"')?.content).toBe('index,follow');
    if (previousRobots === null) meta.removeTag('name="robots"');
    else meta.updateTag({ name: 'robots', content: previousRobots });
  });
});

describe('Public renewal route', () => {
  it('loads the public page without an authentication or public-only guard', async () => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule] });
    const route = TestBed.inject(Router).config.find(candidate => candidate.path === 'renovar/:token');
    expect(route).toBeDefined();
    expect(route?.canActivate?.length || 0).toBe(0);
    expect(route?.canMatch?.length || 0).toBe(0);
    expect(await route?.loadComponent?.()).toBe(PublicRenewalComponent);
  });
});

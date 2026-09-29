import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { CreatedRenewalLink, RenewalLinkSummary, RenewalLinksService } from 'src/app/core/services/renewal-links.service';
import { ProcessRenewalLinksDialogComponent } from './process-renewal-links-dialog.component';

describe('ProcessRenewalLinksDialogComponent', () => {
  let fixture: ComponentFixture<ProcessRenewalLinksDialogComponent>;
  let component: ProcessRenewalLinksDialogComponent;
  let service: jasmine.SpyObj<RenewalLinksService>;
  const client = { id: 'client-1', label: 'MARIA GARCIA' };
  const created: CreatedRenewalLink = { id: 'link-1', token: 'secret-token', client: { id: client.id, name: client.label }, deviceCount: 2, expiresAt: '2026-10-06T12:00:00Z' };
  const active: RenewalLinkSummary = { id: created.id, client: created.client, createdAt: '2026-09-29T12:00:00Z', expiresAt: created.expiresAt, status: 'active', deviceCount: 2 };
  const response: RenewalLinkSummary = { ...active, id: 'response-1', status: 'submitted', submittedAt: '2026-09-29T13:00:00Z', decisions: [
    { deviceId: 'device-1', name: 'Toyota', imei: '123', renew: true, expirationDate: '2026-09-20T00:00:00.000Z' },
    { deviceId: 'device-2', name: 'Honda', imei: '456', renew: false },
  ] };

  beforeEach(async () => {
    service = jasmine.createSpyObj('RenewalLinksService', ['create', 'getForClient', 'revoke']);
    service.create.and.returnValue(of(created));
    service.getForClient.and.returnValue(of([active, response]));
    service.revoke.and.returnValue(of({ ...active, status: 'revoked' }));
    await TestBed.configureTestingModule({ imports: [ProcessRenewalLinksDialogComponent, NoopAnimationsModule], providers: [{ provide: RenewalLinksService, useValue: service }] }).compileComponents();
    fixture = TestBed.createComponent(ProcessRenewalLinksDialogComponent);
    component = fixture.componentInstance;
  });
  afterEach(() => fixture.destroy());

  function open(mode: 'generate' | 'responses' = 'generate') {
    fixture.componentRef.setInput('client', client);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  it('generates one link for the full client and displays its shareable URL and responses', () => {
    open();
    expect(service.create).toHaveBeenCalledOnceWith(client.id);
    expect(service.getForClient).toHaveBeenCalledOnceWith(client.id);
    expect(component.clientName).toBe('Maria Garcia');
    expect(component.linkUrl).toBe(`${window.location.origin}/renovar/secret-token`);
    expect(fixture.nativeElement.textContent).toContain('Enlace listo para compartir');
    expect(fixture.nativeElement.textContent).toContain('Renovar');
    expect(fixture.nativeElement.textContent).toContain('No renovar');
    expect(component.renewalCount(response)).toBe(1);
    expect(component.declineCount(response)).toBe(1);
  });

  it('opens responses without creating another link', () => {
    open('responses');
    expect(service.create).not.toHaveBeenCalled();
    expect(component.selectedLink).toEqual(response);
    expect(component.linkUrl).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Toyota');
    expect(fixture.nativeElement.textContent).toContain('Honda');
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
    expect(component.selectedLink).toEqual(response);
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
    expect(component.selectedLink).toEqual(response);
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
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { RenewalLinksOverviewPage, RenewalLinksService } from 'src/app/core/services/renewal-links.service';
import { ProcessRenewalLinksOverviewDialogComponent } from './process-renewal-links-overview-dialog.component';
import { AuthService } from 'src/app/core/services/auth.service';

describe('ProcessRenewalLinksOverviewDialogComponent', () => {
  let fixture: ComponentFixture<ProcessRenewalLinksOverviewDialogComponent>;
  let component: ProcessRenewalLinksOverviewDialogComponent;
  let service: jasmine.SpyObj<RenewalLinksService>;
  let auth: jasmine.SpyObj<AuthService>;
  const counts = { all: 3, active: 1, submitted: 1, pending_processing: 1, processed: 0, revoked: 1 };
  const page: RenewalLinksOverviewPage = { total: 3, counts, items: [
    { id: 'submitted', client: { id: 'c1', name: 'INVERSIONES MJ GARCIA' }, createdAt: '2026-10-01T12:00:00Z',
      status: 'submitted', deviceCount: 2, submittedAt: '2026-10-02T12:00:00Z',
      createdBy: { id: 'u1', name: 'AYLINE MADERA' },
      expirationFilter: { mode: 'range', dateFrom: '2026-09-18', dateTo: '2026-10-12' },
      decisions: [
        { deviceId: 'd1', name: 'Toyota Rav4', imei: '111', renew: true, expirationDate: '2026-10-09T04:00:00Z' },
        { deviceId: 'd2', name: 'Kia K5', imei: '222', renew: false },
      ] },
    { id: 'active', client: { id: 'c2', name: 'DTH AUTO SALES' }, createdAt: '2026-09-30T12:00:00Z',
      status: 'active', deviceCount: 5 },
    { id: 'revoked', client: { id: 'c3', name: 'Otro' }, createdAt: '2026-09-29T12:00:00Z',
      status: 'revoked', deviceCount: 1 },
  ] };

  beforeEach(async () => {
    service = jasmine.createSpyObj('RenewalLinksService', ['listAll', 'getShareLink', 'regenerateLink', 'undoConfirmation']);
    auth = jasmine.createSpyObj('AuthService', ['isRootUser']);
    auth.isRootUser.and.returnValue(false);
    service.listAll.and.returnValue(of(page));
    await TestBed.configureTestingModule({ imports: [ProcessRenewalLinksOverviewDialogComponent, NoopAnimationsModule],
      providers: [{ provide: RenewalLinksService, useValue: service }, { provide: AuthService, useValue: auth }] }).compileComponents();
    fixture = TestBed.createComponent(ProcessRenewalLinksOverviewDialogComponent);
    component = fixture.componentInstance;
  });
  afterEach(() => fixture.destroy());

  function open() {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }
  const text = () => document.body.textContent || '';

  it('lists every link with its client, range, device count and answer', () => {
    open();
    expect(service.listAll).toHaveBeenCalledWith({ status: 'all', search: '', offset: 0, limit: 30 });
    expect(text()).toContain('Inversiones Mj Garcia');
    expect(text()).toContain('Del 18/09/2026 al 12/10/2026');
    expect(text()).toContain('Por procesar');
    expect(text()).toContain('1 renovar');
    expect(text()).toContain('Esperando respuesta');
    expect(text()).toContain('Anulado');
    expect(text()).toContain('3 de 3 enlaces');
  });

  it('shows which devices the client chose to renew or not', () => {
    open();
    component.toggle(page.items[0]); fixture.detectChanges();
    const rows = Array.from(document.querySelectorAll('.overview-decisions tbody tr')).map(row => row.textContent || '');
    expect(rows[0]).toContain('Toyota Rav4');
    expect(rows[0]).toContain('Renovar');
    expect(rows[1]).toContain('No renovar');
  });

  it('groups the client selection by subaccount', () => {
    const withAccounts = { ...page, items: [{ ...page.items[0], decisions: [
      { ...page.items[0].decisions![0], account: { path: ['INVERSIONES MJ'] } },
      { ...page.items[0].decisions![1], account: { path: ['INVERSIONES MJ', 'JOSE FRANCISCO'] } },
    ] }] };
    service.listAll.and.returnValue(of(withAccounts));
    open();
    component.toggle(withAccounts.items[0]); fixture.detectChanges();
    const headers = Array.from(document.querySelectorAll('.overview-account-row')).map(row => row.textContent || '');
    expect(headers.length).toBe(2);
    expect(headers[1]).toContain('Jose Francisco');
  });

  it('filters by status and client, and opens a link to manage it', () => {
    open();
    component.setStatus('pending_processing');
    expect(service.listAll).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'pending_processing', offset: 0 }));
    component.search = 'mj'; component.applySearch();
    expect(service.listAll).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'pending_processing', search: 'mj' }));
    const emitted = spyOn(component.manage, 'emit');
    component.open(page.items[0]);
    expect(emitted).toHaveBeenCalledWith(page.items[0]);
  });

  it('loads further pages without duplicating links', () => {
    service.listAll.and.returnValue(of({ ...page, total: 4, items: page.items.slice(0, 2) }));
    open();
    service.listAll.and.returnValue(of({ ...page, total: 4, items: [page.items[1], page.items[2]] }));
    component.loadMore();
    expect(service.listAll.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ offset: 2 }));
    expect(component.links.map(link => link.id)).toEqual(['submitted', 'active', 'revoked']);
  });

  it('copies the same link again for open and answered links only', async () => {
    const clipboard = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    service.getShareLink.and.returnValue(of({ id: 'active', token: 'same-token', expiresAt: '2099-10-20T12:00:00Z' }));
    open();
    expect(component.canShare(page.items[0])).toBeTrue();
    expect(component.canShare(page.items[1])).toBeTrue();
    expect(component.canShare(page.items[2])).toBeFalse();
    component.copyLink(page.items[1]);
    await fixture.whenStable(); fixture.detectChanges();
    const url = `${window.location.origin}/renovar/same-token`;
    expect(clipboard).toHaveBeenCalledWith(url);
    expect(component.shared).toEqual({ id: 'active', url, message: 'Enlace copiado.' });
    expect((document.querySelector('#share-url-active') as HTMLInputElement).value).toBe(url);
  });

  it('still copies when the browser refuses the Clipboard API, and offers a direct Copiar button', async () => {
    spyOn(navigator.clipboard, 'writeText').and.rejectWith(new DOMException('Write permission denied.', 'NotAllowedError'));
    const exec = spyOn(document, 'execCommand').and.returnValues(false, true);
    service.getShareLink.and.returnValue(of({ id: 'active', token: 'same-token', expiresAt: '2099-10-20T12:00:00Z' }));
    open();
    component.copyLink(page.items[1]);
    await fixture.whenStable(); fixture.detectChanges();
    expect(component.shared?.message).toContain('pulsa «Copiar»');
    const button = Array.from(document.querySelectorAll('.overview-share__url button')) as HTMLButtonElement[];
    button[0].click(); fixture.detectChanges();
    expect(exec).toHaveBeenCalledTimes(2);
    expect(component.shared?.message).toBe('Enlace copiado.');
  });

  it('offers a new link when an older one cannot be copied, warning that the old one stops working', async () => {
    spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    service.getShareLink.and.returnValue(throwError(() => ({ status: 409, error: { code: 'RENEWAL_LINK_UNAVAILABLE', message: 'x' } })));
    service.regenerateLink.and.returnValue(of({ id: 'active', token: 'new-token', expiresAt: '2099-10-20T12:00:00Z' }));
    open();
    component.copyLink(page.items[1]); fixture.detectChanges();
    expect(component.regenerateOfferId).toBe('active');
    expect(service.regenerateLink).not.toHaveBeenCalled();
    expect(text()).toContain('el enlace anterior dejará de funcionar');
    component.confirmRegenerate(page.items[1]);
    await fixture.whenStable();
    expect(service.regenerateLink).toHaveBeenCalledOnceWith('active');
    expect(component.shared?.url).toContain('/renovar/new-token');
    expect(component.shared?.message).toContain('El anterior ya no funciona');
  });

  it('shows an error and lets staff retry', () => {
    service.listAll.and.returnValue(throwError(() => ({ error: { message: 'Sin conexión' } })));
    open();
    expect(component.error).toContain('Sin conexión');
  });
  it('offers adding or removing GPS only to root users, on links not yet processed', () => {
    fixture.componentRef.setInput('visible', true); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Agregar o quitar');
    auth.isRootUser.and.returnValue(true);
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .filter(button => button.textContent?.includes('Agregar o quitar'));
    expect(buttons.length).toBe(2);
    expect(component.canEditDevices(page.items.find(item => item.status === 'revoked')!)).toBeFalse();
    const emitted: string[] = [];
    component.editDevices.subscribe(link => emitted.push(link.id));
    buttons[0].click();
    expect(emitted).toEqual(['submitted']);
  });
  it('undoes a confirmed response after asking, and reloads the list', () => {
    service.undoConfirmation.and.returnValue(of({ ...page.items[0], status: 'active', decisions: undefined }));
    fixture.componentRef.setInput('visible', true); fixture.detectChanges();
    const submitted = page.items[0];
    expect(component.canUndoConfirmation(submitted)).toBeTrue();
    expect(component.canUndoConfirmation(page.items[1])).toBeFalse();
    expect(component.canUndoConfirmation({ ...submitted, execution: { status: 'completed' } as any })).toBeTrue();
    expect(component.canUndoConfirmation({ ...submitted, execution: { status: 'processing' } as any })).toBeFalse();
    component.askUndoConfirmation(submitted); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sí, deshacer');
    service.listAll.calls.reset();
    component.confirmUndoConfirmation(submitted); fixture.detectChanges();
    expect(service.undoConfirmation).toHaveBeenCalledOnceWith('submitted');
    expect(service.listAll).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Se deshizo la confirmación');
  });
});

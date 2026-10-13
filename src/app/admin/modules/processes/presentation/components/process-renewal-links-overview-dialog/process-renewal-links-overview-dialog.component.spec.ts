import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { RenewalLinksOverviewPage, RenewalLinksService } from 'src/app/core/services/renewal-links.service';
import { ProcessRenewalLinksOverviewDialogComponent } from './process-renewal-links-overview-dialog.component';

describe('ProcessRenewalLinksOverviewDialogComponent', () => {
  let fixture: ComponentFixture<ProcessRenewalLinksOverviewDialogComponent>;
  let component: ProcessRenewalLinksOverviewDialogComponent;
  let service: jasmine.SpyObj<RenewalLinksService>;
  const counts = { all: 3, active: 1, submitted: 1, pending_processing: 1, processed: 0, expired: 0, revoked: 1 };
  const page: RenewalLinksOverviewPage = { total: 3, counts, items: [
    { id: 'submitted', client: { id: 'c1', name: 'INVERSIONES MJ GARCIA' }, createdAt: '2026-10-01T12:00:00Z',
      expiresAt: '2026-10-08T12:00:00Z', status: 'submitted', deviceCount: 2, submittedAt: '2026-10-02T12:00:00Z',
      createdBy: { id: 'u1', name: 'AYLINE MADERA' },
      expirationFilter: { mode: 'range', dateFrom: '2026-09-18', dateTo: '2026-10-12' },
      decisions: [
        { deviceId: 'd1', name: 'Toyota Rav4', imei: '111', renew: true, expirationDate: '2026-10-09T04:00:00Z' },
        { deviceId: 'd2', name: 'Kia K5', imei: '222', renew: false },
      ] },
    { id: 'active', client: { id: 'c2', name: 'DTH AUTO SALES' }, createdAt: '2026-09-30T12:00:00Z',
      expiresAt: '2026-10-20T12:00:00Z', status: 'active', deviceCount: 5 },
    { id: 'revoked', client: { id: 'c3', name: 'Otro' }, createdAt: '2026-09-29T12:00:00Z',
      expiresAt: '2026-10-06T12:00:00Z', status: 'revoked', deviceCount: 1 },
  ] };

  beforeEach(async () => {
    service = jasmine.createSpyObj('RenewalLinksService', ['listAll']);
    service.listAll.and.returnValue(of(page));
    await TestBed.configureTestingModule({ imports: [ProcessRenewalLinksOverviewDialogComponent, NoopAnimationsModule],
      providers: [{ provide: RenewalLinksService, useValue: service }] }).compileComponents();
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

  it('shows an error and lets staff retry', () => {
    service.listAll.and.returnValue(throwError(() => ({ error: { message: 'Sin conexión' } })));
    open();
    expect(component.error).toContain('Sin conexión');
  });
});

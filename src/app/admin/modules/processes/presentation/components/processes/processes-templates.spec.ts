import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { RenewalLinksService } from 'src/app/core/services/renewal-links.service';
import { ProcessRenewalLinksDialogComponent } from '../process-renewal-links-dialog/process-renewal-links-dialog.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { ColorsService } from 'src/app/core/services/colors.service';
import { ContactsService } from 'src/app/core/services/contacts.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { SolicitudesService } from 'src/app/core/services/solicitudes.service';
import { TagsService } from 'src/app/core/services/tags.service';
import { TargetsService } from 'src/app/core/services/targets.service';
import { UserService } from 'src/app/core/services/user.service';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ProcessesModule } from '../../processes.module';
import { ProcessItem, ProcessesService } from '../../services/processes.service';
import { ProcessTemplateConfiguration, ProcessTemplatesDialogComponent } from '../process-templates-dialog/process-templates-dialog.component';
import { ProcessesComponent } from './processes.component';

describe('Processes filter templates integration', () => {
  let fixture: ComponentFixture<ProcessesComponent>;
  let component: ProcessesComponent;
  let service: jasmine.SpyObj<ProcessesService>;
  let renewalLinks: jasmine.SpyObj<RenewalLinksService>;
  const client = { id: 'client-1', label: 'Cliente Uno', email: 'cliente@example.test' };
  const configuration: ProcessTemplateConfiguration = {
    types: [4], client,
    dateFrom: new Date(2026, 8, 1, 0, 0, 0, 0),
    dateTo: new Date(2026, 8, 30, 23, 59, 59, 999),
  };

  beforeEach(async () => {
    renewalLinks = jasmine.createSpyObj('RenewalLinksService', ['create', 'getForClient', 'revoke']);
    renewalLinks.create.and.returnValue(of({ id: 'link', token: 'token', client: { id: client.id, name: client.label }, expiresAt: '2026-10-06T12:00:00Z', deviceCount: 30 }));
    renewalLinks.getForClient.and.returnValue(of([]));
    service = jasmine.createSpyObj('ProcessesService', ['getPaginated', 'searchClients', 'updateVerificationStatus']);
    service.getPaginated.and.returnValue(of({ data: [], total: 0, page: 1, lastPage: 1 }));
    service.searchClients.and.returnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [ProcessesModule, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ProcessesService, useValue: service },
        { provide: RenewalLinksService, useValue: renewalLinks },
        { provide: UserService, useValue: { getTechnicians: () => of([]), getEmployees: () => of([]) } },
        { provide: VehicleBrandsService, useValue: { getAllBrands: () => Promise.resolve([]) } },
        { provide: ColorsService, useValue: { getAllColors: () => Promise.resolve([]) } },
        { provide: ProtocolsService, useValue: { getAllProtocols: () => of([]) } },
        { provide: TargetsService, useValue: {} },
        { provide: SolicitudesService, useValue: {} },
        { provide: AuthService, useValue: {} },
        { provide: ContactsService, useValue: {} },
        { provide: TagsService, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProcessesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    service.getPaginated.calls.reset();
  });

  afterEach(async () => {
    await fixture.whenStable();
    component.templatesDialogVisible = false;
    component.renewalLinksDialogVisible = false;
    component.closeDetail();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.destroy();
  });

  function dialog(): ProcessTemplatesDialogComponent {
    return fixture.debugElement.query(By.directive(ProcessTemplatesDialogComponent)).componentInstance;
  }

  function openTemplates(): void {
    (fixture.nativeElement.querySelector('.processes-templates-button') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('opens from Plantillas with the current client and dates without changing the listing', () => {
    component.selectedClient = client;
    component.dateFrom = configuration.dateFrom;
    component.dateTo = configuration.dateTo;
    component.selectedTypes = [1, 18];
    openTemplates();
    expect(dialog().visible).toBeTrue();
    expect(dialog().initialClient).toEqual(client);
    expect(dialog().initialDateFrom).toEqual(configuration.dateFrom);
    expect(dialog().initialDateTo).toEqual(configuration.dateTo);
    expect(service.getPaginated).not.toHaveBeenCalled();
    expect(component.selectedTypes).toEqual([1, 18]);
  });

  it('applies the generated configuration, resets conflicting filters and displays the resulting processes', () => {
    const renewal = { _id: 'renewal-1', type: 4, target: {}, user: {}, client: { _id: client.id }, creator: {}, createdAt: '2026-09-20T16:00:00Z' } as ProcessItem;
    service.getPaginated.and.returnValue(of({ data: [renewal], total: 1, page: 1, lastPage: 1 }));
    component.currentPage = 7;
    component.searchQuery = 'otra búsqueda';
    component.selectedTypes = [1, 18];
    component.selectedCreator = 'employee';
    component.selectedMechanic = 'technician';
    component.selectedVerificationStatus = 'rejected';
    openTemplates();
    dialog().generated.emit(configuration);

    expect(service.getPaginated).toHaveBeenCalledWith(1, 20, {
      types: [4], client: client.id,
      dateFrom: configuration.dateFrom!.toISOString(), dateTo: configuration.dateTo!.toISOString(),
    });
    expect(component.currentPage).toBe(1);
    expect(component.processes).toEqual([renewal]);
    expect(component.totalRecords).toBe(1);
    expect(component.templatesDialogVisible).toBeFalse();
    expect(component.filtersExpanded).toBeFalse();
    fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('.process-template-summary');
    expect(summary.textContent).toContain('Renovación');
    expect(summary.textContent).toContain(client.label);
    expect(summary.textContent).toContain('01/09/2026');
    expect(summary.textContent).toContain('30/09/2026');
    expect(component.searchQuery).toBe('');
    expect(component.selectedCreator).toBeNull();
    expect(component.selectedMechanic).toBeNull();
    expect(component.selectedVerificationStatus).toBeNull();
    expect(component.dateFrom).not.toBe(configuration.dateFrom);
    expect(component.dateTo).not.toBe(configuration.dateTo);
    expect(component.selectedClient).not.toBe(configuration.client);
    expect(component.selectedTypes).not.toBe(configuration.types);
  });

  it('keeps the template filters on subsequent pages and supports all clients', () => {
    component.selectedClient = client;
    component.applyTemplate({ ...configuration, client: null, types: [20] });
    component.onPageChange({ first: 40, rows: 20 });
    expect(service.getPaginated.calls.mostRecent().args).toEqual([3, 20, {
      types: [20], dateFrom: configuration.dateFrom!.toISOString(), dateTo: configuration.dateTo!.toISOString(),
    }]);
    expect(component.selectedClient).toBeNull();
    expect(component.templateFiltersApplied).toBeTrue();
  });

  it('keeps the summary when opening filters and removes it after a manual change or reset', () => {
    component.applyTemplate(configuration);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.process-template-summary__edit') as HTMLButtonElement).click();
    expect(component.filtersExpanded).toBeTrue();
    expect(component.templateFiltersApplied).toBeTrue();
    component.onProcessTypesChange([1]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.process-template-summary')).toBeNull();
    component.applyTemplate(configuration);
    component.clearFilters();
    expect(component.templateFiltersApplied).toBeFalse();
  });

  it('cancelling the modal preserves the active filters and does not fetch processes', () => {
    component.selectedClient = client;
    component.selectedTypes = [9, 13];
    component.currentPage = 4;
    const beforeFrom = component.dateFrom;
    const beforeTo = component.dateTo;
    openTemplates();
    dialog().visibleChange.emit(false);
    fixture.detectChanges();
    expect(component.templatesDialogVisible).toBeFalse();
    expect(component.selectedClient).toEqual(client);
    expect(component.selectedTypes).toEqual([9, 13]);
    expect(component.currentPage).toBe(4);
    expect(component.dateFrom).toBe(beforeFrom);
    expect(component.dateTo).toBe(beforeTo);
    expect(service.getPaginated).not.toHaveBeenCalled();
  });

  it('ignores a pending response for older filters after generating a template', () => {
    const previous = new Subject<any>();
    service.getPaginated.and.returnValues(previous, of({ data: [], total: 0, page: 1, lastPage: 1 }));
    component.loadProcesses();
    component.applyTemplate(configuration);
    previous.next({ data: [{ _id: 'wrong-filter' }], total: 1 });
    expect(component.processes).toEqual([]);
    expect(component.totalRecords).toBe(0);
  });

  it('does not present previous results as matches when the template request fails', () => {
    component.processes = [{ _id: 'old-result', type: 1 } as ProcessItem];
    component.totalRecords = 1;
    service.getPaginated.and.returnValue(throwError(() => new Error('Unavailable')));
    component.applyTemplate(configuration);
    expect(component.loading).toBeFalse();
    expect(component.processes).toEqual([]);
    expect(component.totalRecords).toBe(0);
    expect(component.selectedTypes).toEqual([4]);
  });

  it('requests all pending renewals without inheriting the current-month range', () => {
    component.selectedClient = client;
    component.currentPage = 5;
    component.selectedCreator = 'employee-1';
    component.selectedVerificationStatus = 'verified';
    component.onProcessTypesChange([22]);
    expect(component.typeOptions).toContain({ label: 'Renovación pendiente', value: 22 });
    expect(service.getPaginated).toHaveBeenCalledWith(1, 20, { types: [22], client: client.id });
    expect(component.dateFrom).toBeNull();
    expect(component.dateTo).toBeNull();
    expect(component.onlyPendingRenewals).toBeTrue();
  });

  it('supports a pending-renewal template with no dates and a single optional date bound', () => {
    component.applyTemplate({ types: [22], client, dateFrom: null, dateTo: null });
    fixture.detectChanges();
    expect(service.getPaginated.calls.mostRecent().args).toEqual([1, 20, { types: [22], client: client.id }]);
    expect(fixture.nativeElement.querySelector('.process-template-summary').textContent).toContain('Todos los vencimientos');
    expect(fixture.nativeElement.querySelector('.column-date').textContent).toContain('Vencimiento');
    component.applyTemplate({ types: [22], client, dateFrom: null, dateTo: configuration.dateTo });
    expect(service.getPaginated.calls.mostRecent().args).toEqual([1, 20, {
      types: [22], client: client.id, dateTo: configuration.dateTo!.toISOString(),
    }]);
  });

  it('keeps mixed process types and manually narrowed dates when paging pending renewals', () => {
    component.selectedClient = client;
    component.onProcessTypesChange([22]);
    component.dateFrom = configuration.dateFrom;
    component.dateTo = configuration.dateTo;
    component.onProcessTypesChange([22, 4]);
    component.onPageChange({ first: 20, rows: 20 });
    expect(component.onlyPendingRenewals).toBeFalse();
    expect(service.getPaginated.calls.mostRecent().args).toEqual([2, 20, {
      types: [22, 4], client: client.id, dateFrom: configuration.dateFrom!.toISOString(), dateTo: configuration.dateTo!.toISOString(),
    }]);
  });

  it('shows pending renewals and details without allowing manual verification', () => {
    const pending = {
      _id: 'pending-renewal:device-1', type: 22, readOnly: true,
      target: { _id: 'device-1', name: 'Vehículo vencido', device_imei: '123456789012345' },
      user: {}, client, creator: null, verificationStatus: 'pending',
      registrationDate: '2026-01-15T12:00:00Z', createdAt: '2026-01-15T12:00:00Z',
    } as unknown as ProcessItem;
    component.selectedClient = client;
    component.selectedTypes = [22];
    component.processes = [pending];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Pendiente de renovar');
    expect(fixture.nativeElement.querySelector('tbody .verification-status-dropdown')).toBeNull();
    component.showDetail(pending);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-summary').textContent).toContain('Vencimiento');
    expect(fixture.nativeElement.querySelector('.detail-summary').textContent).not.toContain('Creado:');
    expect(fixture.nativeElement.querySelector('.verification-status-dropdown--detail')).toBeNull();
    component.updateProcessVerificationStatus(pending, 'verified');
    component.updateProcessVerificationStatus({ ...pending, readOnly: undefined }, 'verified');
    expect(service.updateVerificationStatus).not.toHaveBeenCalled();
    expect(component.canVerifyProcess({ ...pending, type: 4, readOnly: false })).toBeTrue();
  });

  it('only offers pending renewals after selecting a client and preserves other process types', () => {
    expect(component.typeOptions.some(option => option.value === 22)).toBeFalse();
    component.onProcessTypesChange([4, 22]);
    expect(component.selectedTypes).toEqual([4]);
    component.onClientFilterChange(client);
    component.onClientSelected();
    expect(component.typeOptions.some(option => option.value === 22)).toBeTrue();
    component.onProcessTypesChange([4, 22]);
    expect(component.selectedTypes).toEqual([4, 22]);
    component.clearClientFilter();
    expect(component.typeOptions.some(option => option.value === 22)).toBeFalse();
    expect(component.selectedTypes).toEqual([4]);
    expect(service.getPaginated.calls.mostRecent().args).toEqual([1, 20, { types: [4] }]);
  });

  it('cancels a pending response and removes renewal rows when the client is cleared', () => {
    const previous = new Subject<any>();
    service.getPaginated.and.returnValues(previous, of({ data: [], total: 0, page: 1, lastPage: 1 }));
    component.applyTemplate({ types: [22], client, dateFrom: null, dateTo: null });
    component.onClientFilterChange(null);
    expect(previous.observed).toBeFalse();
    previous.next({ data: [{ _id: 'old-client-pending', type: 22 }], total: 1 });
    expect(component.processes).toEqual([]);
    expect(component.totalRecords).toBe(0);
    expect(component.selectedTypes).toEqual([]);
    expect(component.templateFiltersApplied).toBeFalse();
    expect(service.getPaginated.calls.mostRecent().args).toEqual([1, 20, {}]);
  });

  it('treats free text or a blank client identifier as no client', () => {
    component.selectedClient = client;
    component.selectedTypes = [22];
    component.onClientFilterChange('texto sin seleccionar');
    expect(component.selectedClient).toBeNull();
    expect(component.selectedTypes).toEqual([]);
    component.onClientFilterChange({ ...client, id: '   ' });
    expect(component.hasSelectedClient).toBeFalse();
    expect(component.typeOptions.some(option => option.value === 22)).toBeFalse();
  });

  it('guards template generation, list loading and exporting without a selected client', async () => {
    component.templatesDialogVisible = true;
    component.applyTemplate({ types: [22], client: null, dateFrom: null, dateTo: null });
    expect(component.templatesDialogVisible).toBeTrue();
    expect(component.selectedTypes).toEqual([]);
    component.selectedTypes = [22, 4];
    component.loadProcesses();
    await component.exportExcel();
    expect(service.getPaginated).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
    expect(component.processes).toEqual([]);
  });
  it('only offers renewal links when pending renewal and a client are selected', () => {
    expect(fixture.nativeElement.querySelector('.process-renewal-link-generate')).toBeNull();
    component.selectedTypes = [22]; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.process-renewal-link-generate')).toBeNull();
    component.selectedClient = client; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.process-renewal-link-generate')).not.toBeNull();
    component.selectedTypes = [4]; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.process-renewal-link-generate')).toBeNull();
  });

  it('generates the full client link regardless of page, search or date filters', () => {
    component.selectedClient = client; component.selectedTypes = [22];
    component.currentPage = 3; component.searchQuery = 'Toyota';
    component.dateFrom = configuration.dateFrom;
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.process-renewal-link-generate').click();
    fixture.detectChanges();
    const modal = fixture.debugElement.query(By.directive(ProcessRenewalLinksDialogComponent)).componentInstance as ProcessRenewalLinksDialogComponent;
    expect(modal.mode).toBe('generate');
    expect(modal.client).toEqual({ id: client.id, label: client.label });
    expect(modal.client).not.toBe(client);
    expect(renewalLinks.create).toHaveBeenCalledOnceWith(client.id);
    expect(service.getPaginated).not.toHaveBeenCalled();
  });

  it('opens saved responses without generating another link', () => {
    component.selectedClient = client; component.selectedTypes = [22]; fixture.detectChanges();
    fixture.nativeElement.querySelector('.process-renewal-link-responses').click();
    fixture.detectChanges();
    expect(component.renewalLinksMode).toBe('responses');
    expect(renewalLinks.getForClient).toHaveBeenCalledOnceWith(client.id);
    expect(renewalLinks.create).not.toHaveBeenCalled();
  });

  it('guards direct modal opening without pending renewal or a selected client', () => {
    component.selectedClient = client; component.selectedTypes = [4];
    component.openRenewalLinks('generate');
    expect(component.renewalLinksDialogVisible).toBeFalse();
    component.selectedTypes = [22]; component.selectedClient = null;
    component.openRenewalLinks('responses');
    expect(component.renewalLinksDialogVisible).toBeFalse();
  });

});

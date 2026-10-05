import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import * as XLSX from 'xlsx-js-style';
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
  const client = { id: 'client-1', label: 'Cliente Uno', email: 'cliente@example.test', phone: '8095550100' };
  const configuration: ProcessTemplateConfiguration = {
    types: [4], client,
    dateFrom: new Date(2026, 8, 1, 0, 0, 0, 0),
    dateTo: new Date(2026, 8, 30, 23, 59, 59, 999),
  };

  function groupResponse(data: ProcessItem[], page = 1, total = data.length, lastPage = 1) {
    return {
      groups: data.length ? [{
        id: `client-page-${page}`, name: client.label, contact: client.email,
        route: [{ id: `client-page-${page}`, fullName: client.label }],
        total: data.length, processes: data, page: 1, lastPage: 1,
      }] : [],
      total, totalGroups: data.length ? lastPage : 0, page, lastPage,
    };
  }

  beforeEach(async () => {
    renewalLinks = jasmine.createSpyObj('RenewalLinksService', ['create', 'getForClient', 'revoke']);
    renewalLinks.create.and.returnValue(of({ id: 'link', token: 'token', client: { id: client.id, name: client.label }, expiresAt: '2026-10-06T12:00:00Z', deviceCount: 30 }));
    renewalLinks.getForClient.and.returnValue(of([]));
    service = jasmine.createSpyObj('ProcessesService', ['getPaginated', 'getClientGroups', 'getClientGroupProcesses', 'searchClients', 'updateVerificationStatus']);
    service.getClientGroups.and.returnValue(of(groupResponse([])));
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
        { provide: AuthService, useValue: { getCurrentUser: () => ({ root: true }), hasPrivilege: () => true } },
        { provide: ContactsService, useValue: {} },
        { provide: TagsService, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProcessesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    service.getClientGroups.calls.reset();
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
    expect(service.getClientGroups).not.toHaveBeenCalled();
    expect(component.selectedTypes).toEqual([1, 18]);
  });

  it('applies the generated configuration, resets conflicting filters and displays the resulting processes', () => {
    const renewal = { _id: 'renewal-1', type: 4, target: {}, user: {}, client: { _id: client.id }, creator: {}, createdAt: '2026-09-20T16:00:00Z' } as ProcessItem;
    service.getClientGroups.and.returnValue(of(groupResponse([renewal])));
    component.currentPage = 7;
    component.searchQuery = 'otra búsqueda';
    component.selectedTypes = [1, 18];
    component.selectedCreator = 'employee';
    component.selectedMechanic = 'technician';
    component.selectedVerificationStatus = 'rejected';
    openTemplates();
    dialog().generated.emit(configuration);

    expect(service.getClientGroups).toHaveBeenCalledWith(1, 10, {
      types: [4], client: client.id,
      dateFrom: configuration.dateFrom!.toISOString(), dateTo: configuration.dateTo!.toISOString(),
    }, 20);
    expect(component.currentPage).toBe(1);
    expect(component.processes).toEqual([renewal]);
    expect(component.totalRecords).toBe(1);
    expect(component.templatesDialogVisible).toBeFalse();
    expect(component.filtersExpanded).toBeFalse();
    fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('.process-template-summary');
    expect(summary.textContent).toContain('Renovar ( Facturación a crédito )');
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
    service.getClientGroups.and.callFake(page => of(groupResponse([{ _id: `page-${page}` } as ProcessItem], page, 60, 3)));
    component.selectedClient = client;
    component.applyTemplate({ ...configuration, client: null, types: [20] });
    component.loadMoreProcesses();
    component.loadMoreProcesses();
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([3, 10, {
      types: [20], dateFrom: configuration.dateFrom!.toISOString(), dateTo: configuration.dateTo!.toISOString(),
    }, 20]);
    expect(component.selectedClient).toBeNull();
    expect(component.templateFiltersApplied).toBeTrue();
  });

  it('filters office reviews as type 23 and keeps technical checks as type 10', () => {
    expect(component.typeOptions).toContain({ label: 'Revisión', value: 23 });
    expect(component.typeOptions).toContain({ label: 'Chequeo', value: 10 });
    openTemplates();
    const reviewTemplate = dialog().templates.find(template => template.name === 'Revisión')!;
    expect(reviewTemplate.type).toBe(23);
    dialog().chooseTemplate(reviewTemplate);
    dialog().generate();
    expect(service.getClientGroups.calls.mostRecent().args[2]?.types).toEqual([23]);

    component.onProcessTypesChange([10]);
    expect(service.getClientGroups.calls.mostRecent().args[2]?.types).toEqual([10]);
  });

  it('renders and exports new and legacy office reviews without relabeling ordinary checks', async () => {
    const rows = [
      { _id: 'review', type: 23, after: { status: 'in_progress' } },
      { _id: 'legacy-review', type: 10, after: { origin: 'office_management', status: 'completed' } },
      { _id: 'check', type: 10, after: { processType: 'checkup' } },
    ].map(row => ({ ...row, target: {}, user: {}, creator: {},
      createdAt: '2026-10-01T12:00:00Z' } as ProcessItem));
    service.getClientGroups.and.returnValue(of(groupResponse(rows)));
    service.getPaginated.and.returnValue(of({ data: rows, total: 3, page: 1, lastPage: 1 }));
    component.loadProcesses();
    fixture.detectChanges();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('tbody p-tag') as NodeListOf<HTMLElement>)
      .map(element => element.textContent?.trim());
    expect(labels).toEqual(['Revisión', 'Revisión', 'Chequeo']);

    const write = spyOn(XLSX, 'writeFile').and.stub();
    await component.exportExcel();
    expect(write).toHaveBeenCalledTimes(1);
    const sheet = write.calls.mostRecent().args[0].Sheets['Procesos'];
    expect([sheet['B2'].v, sheet['B3'].v, sheet['B4'].v]).toEqual(['Revisión', 'Revisión', 'Chequeo']);
    expect(sheet['B2'].s.font.color.rgb).toBe('2563EB');
    expect(sheet['B3'].s.font.color.rgb).toBe('2563EB');
    expect(sheet['B4'].s.font.color.rgb).toBe('00838F');
  });

  it('replaces the template summary with the visible history scope after a manual change or reset', () => {
    component.applyTemplate(configuration);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.process-template-summary__edit') as HTMLButtonElement).click();
    expect(component.filtersExpanded).toBeTrue();
    expect(component.templateFiltersApplied).toBeTrue();
    component.onProcessTypesChange([1]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.process-template-summary:not(.process-history-scope)')).toBeNull();
    const scope = fixture.nativeElement.querySelector('.process-history-scope');
    expect(scope.textContent).toContain('01/09/2026');
    expect(scope.textContent).toContain('30/09/2026');
    component.applyTemplate(configuration);
    component.clearFilters();
    fixture.detectChanges();
    expect(component.templateFiltersApplied).toBeFalse();
    expect(fixture.nativeElement.querySelector('.process-history-scope').textContent)
      .toContain('Todo el historial · Sin límite de fechas');
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
    expect(service.getClientGroups).not.toHaveBeenCalled();
  });

  it('ignores a pending response for older filters after generating a template', () => {
    const previous = new Subject<any>();
    service.getClientGroups.and.returnValues(previous, of(groupResponse([])));
    component.loadProcesses();
    component.applyTemplate(configuration);
    previous.next(groupResponse([{ _id: 'wrong-filter' } as ProcessItem]));
    expect(component.processes).toEqual([]);
    expect(component.totalRecords).toBe(0);
  });

  it('does not present previous results as matches when the template request fails', () => {
    component.processes = [{ _id: 'old-result', type: 1 } as ProcessItem];
    component.totalRecords = 1;
    service.getClientGroups.and.returnValue(throwError(() => new Error('Unavailable')));
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
    expect(service.getClientGroups).toHaveBeenCalledWith(1, 10, { types: [22], client: client.id }, 20);
    expect(component.dateFrom).toBeNull();
    expect(component.dateTo).toBeNull();
    expect(component.onlyPendingRenewals).toBeTrue();
  });

  it('supports a pending-renewal template with no dates and a single optional date bound', () => {
    // Client cards render their table headings only when that client has rows.
    const pending = {
      _id: 'pending-renewal:template-device', type: 22, readOnly: true,
      target: { _id: 'template-device', name: 'Vehículo pendiente' },
      client: { _id: client.id, name: client.label }, user: {}, creator: null,
      registrationDate: '2026-09-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z',
    } as ProcessItem;
    service.getClientGroups.and.returnValue(of(groupResponse([pending])));
    component.applyTemplate({ types: [22], client, dateFrom: null, dateTo: null });
    fixture.detectChanges();
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([1, 10, { types: [22], client: client.id }, 20]);
    expect(fixture.nativeElement.querySelector('.process-template-summary').textContent).toContain('Todos los dispositivos vencidos');
    expect(fixture.nativeElement.querySelector('.process-pending-renewal-note').textContent).toContain('Sin fechas se muestran solo los dispositivos actualmente vencidos');
    expect(fixture.nativeElement.querySelector('.column-date').textContent).toContain('Vencimiento');
    component.applyTemplate({ types: [22], client, dateFrom: null, dateTo: configuration.dateTo });
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([1, 10, {
      types: [22], client: client.id, dateTo: '2026-09-30',
    }, 20]);
  });

  it('generates a future expiry range and displays the returned device before it expires', () => {
    const futureYear = new Date().getFullYear() + 1;
    const from = new Date(futureYear, 0, 10, 12);
    const to = new Date(futureYear, 0, 12, 12);
    const pending = {
      _id: 'pending-renewal:future-device', type: 22, readOnly: true,
      target: { _id: 'future-device', name: 'Vehículo por vencer', device_imei: '123456789012345' },
      user: {}, client, creator: null, verificationStatus: 'pending',
      registrationDate: new Date(futureYear, 0, 11, 12).toISOString(),
      createdAt: new Date(futureYear, 0, 11, 12).toISOString(),
    } as unknown as ProcessItem;
    service.getClientGroups.and.returnValue(of(groupResponse([pending])));
    component.selectedClient = client;
    openTemplates();
    (fixture.nativeElement.querySelector('[data-process-type="22"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    dialog().dateFrom = from;
    dialog().dateTo = to;
    (fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(service.getClientGroups).toHaveBeenCalledOnceWith(1, 10, {
      types: [22], client: client.id,
      dateFrom: `${futureYear}-01-10`,
      dateTo: `${futureYear}-01-12`,
    }, 20);
    expect(component.processes).toEqual([pending]);
    expect(component.totalRecords).toBe(1);
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Vehículo Por Vencer');
    expect(fixture.nativeElement.querySelector('.process-pending-renewal-note').textContent).toContain('vencidos o por vencer');
    expect(fixture.nativeElement.querySelector('.process-template-summary').textContent).toContain(`10/01/${futureYear}`);
    expect(fixture.nativeElement.querySelector('.process-template-summary').textContent).toContain(`12/01/${futureYear}`);
    component.showDetail(pending);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-summary__status').textContent).toContain('su vencimiento está dentro de las fechas seleccionadas');
    expect(fixture.nativeElement.querySelector('.detail-summary__status').textContent).toContain('fuera de esos límites');
  });

  it('keeps mixed process types and manually narrowed dates when paging pending renewals', () => {
    service.getClientGroups.and.callFake(page => of(groupResponse([{ _id: `page-${page}` } as ProcessItem], page, 40, 2)));
    component.selectedClient = client;
    component.onProcessTypesChange([22]);
    component.dateFrom = configuration.dateFrom;
    component.dateTo = configuration.dateTo;
    component.onProcessTypesChange([22, 4]);
    component.loadMoreProcesses();
    expect(component.onlyPendingRenewals).toBeFalse();
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([2, 10, {
      types: [22, 4], client: client.id, dateFrom: '2026-09-01', dateTo: '2026-09-30',
    }, 20]);
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
    service.getClientGroups.and.returnValue(of(groupResponse([pending])));
    component.loadProcesses();
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

  it('ofrece Renovación pendiente con y sin cliente, y conserva los demás tipos', () => {
    expect(component.typeOptions.some(option => option.value === 22)).toBeTrue();
    component.onProcessTypesChange([4, 22]);
    expect(component.selectedTypes).toEqual([4, 22]);
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([1, 10, { types: [4, 22] }, 20]);
    component.onClientFilterChange(client);
    component.onClientSelected();
    expect(service.getClientGroups.calls.mostRecent().args)
      .toEqual([1, 10, { types: [4, 22], client: client.id }, 20]);
    component.clearClientFilter();
    expect(component.typeOptions.some(option => option.value === 22)).toBeTrue();
    expect(component.selectedTypes).toEqual([4, 22]);
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([1, 10, { types: [4, 22] }, 20]);
  });

  it('cancels a pending response and removes renewal rows when the client is cleared', () => {
    const previous = new Subject<any>();
    service.getClientGroups.and.returnValues(previous, of(groupResponse([])));
    component.applyTemplate({ types: [22], client, dateFrom: null, dateTo: null });
    component.onClientFilterChange(null);
    expect(previous.observed).toBeFalse();
    previous.next(groupResponse([{ _id: 'old-client-pending', type: 22 } as ProcessItem]));
    expect(component.processes).toEqual([]);
    expect(component.totalRecords).toBe(0);
    // Al quitar el cliente, Renovación pendiente pasa a listar a todos.
    expect(component.selectedTypes).toEqual([22]);
    expect(component.templateFiltersApplied).toBeFalse();
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([1, 10, { types: [22] }, 20]);
  });

  it('treats free text or a blank client identifier as no client', () => {
    component.selectedClient = client;
    component.selectedTypes = [22];
    component.onClientFilterChange('texto sin seleccionar');
    expect(component.selectedClient).toBeNull();
    // Renovación pendiente sigue seleccionada: ahora lista a todos los clientes.
    expect(component.selectedTypes).toEqual([22]);
    component.onClientFilterChange({ ...client, id: '   ' });
    expect(component.hasSelectedClient).toBeFalse();
    expect(component.typeOptions.some(option => option.value === 22)).toBeTrue();
  });

  it('consulta y exporta Renovación pendiente sin cliente seleccionado', async () => {
    component.templatesDialogVisible = true;
    component.applyTemplate({ types: [22], client: null, dateFrom: null, dateTo: null });
    expect(component.selectedTypes).toEqual([22]);
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([1, 10, { types: [22] }, 20]);
    component.selectedTypes = [22, 4];
    component.loadProcesses();
    expect(service.getClientGroups.calls.mostRecent().args).toEqual([1, 10, { types: [22, 4] }, 20]);
    await component.exportExcel();
    expect(service.getPaginated).toHaveBeenCalled();
    expect(component.loading).toBeFalse();
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

  it('refreshes the first page with the current filters after processing a client response', () => {
    component.selectedClient = client;
    component.selectedTypes = [22];
    component.dateFrom = component.dateTo = null;
    component.currentPage = 3;
    component.openRenewalLinks('responses');
    fixture.detectChanges();
    service.getClientGroups.calls.reset();

    const responseDialog = fixture.debugElement.query(By.directive(ProcessRenewalLinksDialogComponent)).componentInstance;
    responseDialog.processed.emit();

    expect(component.currentPage).toBe(1);
    expect(service.getClientGroups).toHaveBeenCalledOnceWith(1, 10, { types: [22], client: client.id }, 20);
    expect(component.renewalLinksDialogVisible).toBeTrue();
  });

  it('passes the selected expiry range to renewal links independently of loaded rows and search', () => {
    component.selectedClient = client; component.selectedTypes = [22];
    component.currentPage = 3; component.searchQuery = 'Toyota';
    component.dateFrom = configuration.dateFrom;
    component.dateTo = configuration.dateTo;
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.process-renewal-link-generate').click();
    fixture.detectChanges();
    const modal = fixture.debugElement.query(By.directive(ProcessRenewalLinksDialogComponent)).componentInstance as ProcessRenewalLinksDialogComponent;
    expect(modal.mode).toBe('generate');
    expect(modal.client).toEqual(client);
    expect(modal.client).not.toBe(client);
    expect(modal.dateFrom).toEqual(configuration.dateFrom);
    expect(modal.dateTo).toEqual(configuration.dateTo);
    expect(renewalLinks.create).toHaveBeenCalledOnceWith(client.id, { dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    expect(service.getClientGroups).not.toHaveBeenCalled();
  });

  it('opens saved responses without generating another link', () => {
    component.selectedClient = client; component.selectedTypes = [22]; fixture.detectChanges();
    fixture.nativeElement.querySelector('.process-renewal-link-responses').click();
    fixture.detectChanges();
    expect(component.renewalLinksMode).toBe('responses');
    const modal = fixture.debugElement.query(By.directive(ProcessRenewalLinksDialogComponent)).componentInstance as ProcessRenewalLinksDialogComponent;
    expect(modal.client).toEqual(client);
    expect(modal.client).not.toBe(client);
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

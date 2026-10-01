import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
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
import { PaginatedProcessResponse, PaginatedProcessClientGroupsResponse, ProcessClientGroupResult, ProcessItem, ProcessesService } from '../../services/processes.service';
import { ProcessesComponent } from './processes.component';

describe('Processes grouped by client', () => {
  let fixture: ComponentFixture<ProcessesComponent>;
  let component: ProcessesComponent;
  let requests: Array<{ page: number; filters: any; response: Subject<PaginatedProcessClientGroupsResponse> }>;
  let rowRequests: Array<{ clientId: string; page: number; limit: number; filters: any; response: Subject<PaginatedProcessResponse> }>;
  let verification: Subject<ProcessItem>;
  let updateVerification: jasmine.Spy;
  const root = { id: 'root-account', fullName: 'Montao GPS', affiliation_type_id: 'administrador' };
  const distributor = { id: 'distributor', fullName: 'Distribuidora Norte', affiliation_type_id: 'distribuidor' };

  function process(id: string, overrides: Partial<ProcessItem> = {}): ProcessItem {
    return {
      _id: id,
      type: 4,
      target: { _id: `target-${id}`, name: `Vehículo ${id}` },
      user: {},
      creator: {},
      verificationStatus: 'pending',
      registrationDate: '2026-09-01T12:00:00Z',
      createdAt: '2026-09-01T12:00:00Z',
      ...overrides,
    } as ProcessItem;
  }

  function ownedProcess(id: string, ownerId: string, name = 'Cliente Uno'): ProcessItem {
    return process(id, {
      client: { _id: ownerId, name, phone: '8095550100' },
      target: { _id: `target-${id}`, name: `Vehículo ${id}`, parent_id: ownerId },
      clientRoute: [root, { id: ownerId, fullName: name, affiliation_type_id: 'cliente' }],
    });
  }

  beforeEach(async () => {
    requests = [];
    rowRequests = [];
    verification = new Subject<ProcessItem>();
    updateVerification = jasmine.createSpy('updateVerificationStatus').and.returnValue(verification.asObservable());
    await TestBed.configureTestingModule({
      imports: [ProcessesModule, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ProcessesService, useValue: {
          getClientGroups: (page: number, _limit: number, filters: any) => {
            const response = new Subject<PaginatedProcessClientGroupsResponse>();
            requests.push({ page, filters, response });
            return response.asObservable();
          },
          getClientGroupProcesses: (clientId: string, page: number, limit: number, filters: any) => {
            const response = new Subject<PaginatedProcessResponse>();
            rowRequests.push({ clientId, page, limit, filters, response });
            return response.asObservable();
          },
          searchClients: () => of([]),
          updateVerificationStatus: updateVerification,
        } },
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
    fixture.nativeElement.style.height = '500px';
    fixture.nativeElement.style.width = '1280px';
    fixture.detectChanges();
    const viewport = fixture.nativeElement.querySelector('.processes-table');
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 2000 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  function group(id: string, processes: ProcessItem[], overrides: Partial<ProcessClientGroupResult> = {}): ProcessClientGroupResult {
    return { id, name: processes[0]?.client?.name || 'Cliente Uno', contact: '8095550100',
      route: processes[0]?.clientRoute || [], total: processes.length, processes, page: 1, lastPage: 1, ...overrides };
  }

  function respondGroups(index: number, groups: ProcessClientGroupResult[], total = groups.reduce((sum, item) => sum + item.total, 0), lastPage = 1): void {
    requests[index].response.next({ groups, total, totalGroups: groups.length, page: requests[index].page, lastPage });
    requests[index].response.complete();
    fixture.detectChanges();
  }

  function respond(index: number, data: ProcessItem[], total = data.length, lastPage = 1): void {
    const owners = [...new Set(data.map(row => String(row.target?.['parent_id'] || row.client?._id || 'unassigned')))];
    respondGroups(index, owners.map(id => group(id, data.filter(row => String(row.target?.['parent_id'] || row.client?._id || 'unassigned') === id))), total, lastPage);
  }

  function installations(clientId: string, count: number, start = 0): ProcessItem[] {
    return Array.from({ length: count }, (_, offset) => {
      const index = start + offset;
      return { ...ownedProcess(`${clientId}-${index}`, clientId), type: 1,
        registrationDate: new Date(Date.UTC(2023, 0, 1, 0, 120 - index * 2)).toISOString() };
    });
  }

  function respondRows(index: number, data: ProcessItem[], total: number, lastPage: number): void {
    rowRequests[index].response.next({ data, total, page: rowRequests[index].page, lastPage });
    rowRequests[index].response.complete();
    fixture.detectChanges();
  }

  it('uses server ownership and keeps equally named clients and subaccounts separate', () => {
    const owner = { id: 'owner-a', fullName: 'Comercio Central', affiliation_type_id: 'cliente' };
    const subaccount = { id: 'subaccount-a', fullName: 'Sucursal Este', affiliation_type_id: 'subcliente' };
    const parentRow = ownedProcess('parent', owner.id, owner.fullName);
    parentRow.clientRoute = [root, distributor, owner];
    const childRow = process('child', {
      target: { _id: 'target-child', parent_id: 'stale-owner' },
      client: { _id: owner.id, name: owner.fullName },
      clientRoute: [root, distributor, owner, subaccount],
    });
    const sameName = ownedProcess('other', 'owner-b', owner.fullName);
    respondGroups(0, [
      group(owner.id, [parentRow]),
      group(subaccount.id, [childRow], { name: subaccount.fullName, route: childRow.clientRoute! }),
      group('owner-b', [sameName]),
    ]);

    const groups = component.clientProcessGroups;
    expect(groups.map(group => group.id)).toEqual(['owner-a', 'subaccount-a', 'owner-b']);
    expect(groups.map(group => group.name)).toEqual(['Comercio Central', 'Sucursal Este', 'Comercio Central']);
    expect(groups[1].route.map(account => account.id)).toEqual([
      root.id, distributor.id, owner.id, subaccount.id,
    ]);
    expect(groups[1].processes).toEqual([childRow]);
    expect(groups[0].contact).toContain('8095550100');
  });

  it('keeps all 17 older installations together despite interleaved dates from another client', () => {
    const firstClient = installations('client-a', 17);
    const secondClient = installations('client-b', 17).map(row => ({ ...row,
      registrationDate: new Date(new Date(row.registrationDate).getTime() - 60000).toISOString() }));
    respondGroups(0, [group('client-a', firstClient), group('client-b', secondClient)]);

    expect(requests[0].filters).toEqual({});
    expect(component.dateFrom).toBeNull();
    expect(component.dateTo).toBeNull();
    expect(component.clientProcessGroups.map(item => item.total)).toEqual([17, 17]);
    expect(component.clientProcessGroups[0].processes).toEqual(firstClient);
    expect(component.processes.length).toBe(34);
    const cards = fixture.nativeElement.querySelectorAll('article.process-client-group');
    expect(cards[0].querySelectorAll('tbody > tr').length).toBe(17);
    expect(cards[0].querySelector('.process-client-group__count').textContent).toContain('17 procesos');
    expect(cards[0].querySelector('.process-client-group__load-more')).toBeNull();
    expect(fixture.nativeElement.querySelector('.process-history-scope').textContent).toMatch(/historial/i);
    expect(rowRequests.length).toBe(0);
  });

  it('preserves an expanded client card when another group page repeats its initial preview', () => {
    const first = installations('client-a', 20);
    respondGroups(0, [group('client-a', first, { total: 25, lastPage: 2 })], 26, 2);
    component.loadMoreClientProcesses(component.clientProcessGroups[0]);
    const remaining = installations('client-a', 5, 20);
    respondRows(0, remaining, 25, 2);
    component.loadMoreProcesses();
    expect(requests.map(request => request.page)).toEqual([1, 2]);
    const other = ownedProcess('other', 'client-b', 'Cliente Dos');
    respondGroups(1, [group('client-a', first, { total: 25, lastPage: 2 }), group('client-b', [other])], 26, 2);

    const groups = component.clientProcessGroups;
    expect(groups.map(item => item.id)).toEqual(['client-a', 'client-b']);
    expect(groups[0].processes).toEqual([...first, ...remaining]);
    expect(groups[0].page).toBe(2);
    expect(groups[1].processes).toEqual([other]);
    expect(component.processes.length).toBe(26);
    expect(fixture.nativeElement.querySelectorAll('article.process-client-group').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.p-datatable-tbody > tr').length).toBe(26);
  });

  it('labels installations without a recorded technician and preserves historical names', () => {
    const rows: ProcessItem[] = [
      { ...ownedProcess('without-technician', 'client-a'), type: 1,
        target: { _id: 'target-null', mechanic_id: null }, details: 'Técnico asignado: No asignado.' },
      { ...ownedProcess('blank-technician', 'client-a'), type: 18,
        target: { _id: 'target-blank', mechanic_id: '   ' } },
      { ...ownedProcess('historical-technician', 'client-a'), type: 1,
        target: { _id: 'target-historical', mechanic_id: null }, details: 'Técnico asignado: luis pérez.' },
      { ...ownedProcess('trimmed-technician', 'client-a'), type: 18,
        target: { _id: 'target-trimmed', mechanic_id: ' technician-id ' } },
      { ...ownedProcess('other-process', 'client-a'), type: 4,
        target: { _id: 'target-other', mechanic_id: null } },
    ];
    component.techniciansMap['technician-id'] = 'Ana García';
    respondGroups(0, [group('client-a', rows)]);

    const labels = Array.from(fixture.nativeElement.querySelectorAll('tbody [title="Técnico"]') as NodeListOf<HTMLElement>)
      .map(element => element.textContent?.trim().toLocaleLowerCase('es'));
    expect(labels).toEqual([
      'sin técnico registrado', 'sin técnico registrado', 'luis pérez', 'ana garcía', 'ninguno',
    ]);
    expect(component.getTechnicianName(rows[0])).toBe('Sin técnico registrado');
    expect(component.getTechnicianName(rows[1])).toBe('Sin técnico registrado');
  });

  it('loads only the remaining processes of a 25-process client with independent counts and loaders', () => {
    const first = installations('client-a', 20);
    const other = ownedProcess('other', 'client-b', 'Cliente Dos');
    respondGroups(0, [group('client-a', first, { total: 25, lastPage: 2 }), group('client-b', [other])]);
    const current = component.clientProcessGroups[0];
    const card: HTMLElement = fixture.nativeElement.querySelector('article.process-client-group');
    expect(card.querySelector('.process-client-group__count')?.textContent).toContain('25 procesos');
    expect(card.querySelector('.process-client-group__progress')?.textContent).toContain('20 de 25');
    const loadMore = card.querySelector('.process-client-group__load-more') as HTMLButtonElement;
    loadMore.click();
    component.loadMoreClientProcesses(current);
    fixture.detectChanges();

    expect(rowRequests.length).toBe(1);
    expect(rowRequests[0]).toEqual(jasmine.objectContaining({ clientId: 'client-a', page: 2, limit: 20, filters: {} }));
    expect(current.loading).toBeTrue();
    expect(component.clientProcessGroups[1].loading).toBeFalse();
    expect(component.loadingMore).toBeFalse();
    expect(loadMore.disabled).toBeTrue();
    expect(requests.length).toBe(1);
    const remaining = installations('client-a', 5, 20);
    // An overlapping row must not be duplicated when the second page arrives.
    respondRows(0, [first[19], ...remaining], 25, 2);
    expect(current.processes).toEqual([...first, ...remaining]);
    expect(current.loading).toBeFalse();
    expect(component.processes.length).toBe(26);
    expect(new Set(component.processes.map(row => row._id)).size).toBe(26);
    expect(card.querySelector('.process-client-group__progress')?.textContent).toContain('25 de 25');
    expect(card.querySelector('.process-client-group__load-more')).toBeNull();
    component.loadMoreClientProcesses(current);
    expect(rowRequests.length).toBe(1);
  });

  it('preserves a client history on error and retries the same page using the applied filters', () => {
    component.searchQuery = 'Camión';
    component.selectedTypes = [1];
    component.dateFrom = new Date(2023, 0, 1);
    component.dateTo = new Date(2023, 11, 31);
    component.applyFilters();
    const first = installations('client-a', 20);
    respondGroups(1, [group('client-a', first, { total: 25, lastPage: 2 })]);
    const current = component.clientProcessGroups[0];
    component.searchQuery = 'borrador';
    component.selectedTypes.push(4);
    component.dateFrom = new Date(2030, 0, 1);
    component.loadMoreClientProcesses(current);
    expect(rowRequests[0].filters).toEqual(requests[1].filters);
    expect(rowRequests[0].filters.types).toEqual([1]);
    rowRequests[0].response.error(new Error('Unavailable'));
    fixture.detectChanges();
    expect(current.processes).toEqual(first);
    expect(current.loading).toBeFalse();
    expect(current.error).not.toBe('');
    const retry = fixture.nativeElement.querySelector('.process-client-group__load-more') as HTMLButtonElement;
    expect(retry.textContent).toContain('Reintentar');
    retry.click();
    expect(rowRequests[1].page).toBe(2);
    expect(rowRequests[1].filters).toEqual(requests[1].filters);
    respondRows(1, installations('client-a', 5, 20), 25, 2);
    expect(current.error).toBe('');
    expect(current.processes.length).toBe(25);
  });

  it('cancels an old client page when filters change even when that client reappears', () => {
    respondGroups(0, [group('client-a', installations('client-a', 20), { total: 25, lastPage: 2 })]);
    component.loadMoreClientProcesses(component.clientProcessGroups[0]);
    const oldResponse = rowRequests[0].response;
    component.selectedTypes = [4];
    component.applyFilters();
    expect(oldResponse.observed).toBeFalse();
    expect(component.clientProcessGroups).toEqual([]);
    const newRow = ownedProcess('only-renewal', 'client-a');
    respondGroups(1, [group('client-a', [newRow])]);
    oldResponse.next({ data: installations('client-a', 5, 20), total: 25, page: 2, lastPage: 2 });
    expect(component.clientProcessGroups[0].processes).toEqual([newRow]);
    expect(component.processes).toEqual([newRow]);
  });

  it('cancels pending client history and client-list requests when destroyed', () => {
    respondGroups(0, [group('client-a', installations('client-a', 20), { total: 25, lastPage: 2 })], 30, 2);
    component.loadMoreClientProcesses(component.clientProcessGroups[0]);
    component.loadMoreProcesses();
    fixture.destroy();
    expect(rowRequests[0].response.observed).toBeFalse();
    expect(requests[1].response.observed).toBeFalse();
  });

  it('clears cached client cards on new filters and ignores the previous page response', () => {
    respond(0, [ownedProcess('old', 'old-client')], 3, 2);
    expect(component.clientProcessGroups.length).toBe(1);
    component.loadMoreProcesses();
    const oldResponse = requests[1].response;
    component.searchQuery = 'Cliente Nuevo';
    component.applyFilters();
    fixture.detectChanges();

    expect(component.clientProcessGroups).toEqual([]);
    expect(fixture.nativeElement.querySelectorAll('article.process-client-group').length).toBe(0);
    expect(oldResponse.observed).toBeFalse();
    oldResponse.next({ groups: [group('old-client', [ownedProcess('late', 'old-client')])], total: 3, totalGroups: 2, page: 2, lastPage: 2 });
    respond(2, [ownedProcess('new', 'new-client', 'Cliente Nuevo')]);
    expect(component.clientProcessGroups.map(group => group.id)).toEqual(['new-client']);
    expect(component.clientProcessGroups[0].processes.map(row => row._id)).toEqual(['new']);
  });

  it('keeps enriched ownership and the selected object when verification returns a raw process', () => {
    const original = ownedProcess('verified-process', 'client-a');
    respond(0, [original]);
    component.selectedProcess = original;
    component.updateProcessVerificationStatus(original, 'verified');
    expect(updateVerification).toHaveBeenCalledOnceWith(original._id, 'verified');
    verification.next({
      _id: original._id,
      target: original.target._id,
      verificationStatus: 'verified',
      verifiedAt: '2026-09-30T12:00:00Z',
    } as unknown as ProcessItem);
    verification.complete();
    fixture.detectChanges();

    const groups = component.clientProcessGroups;
    expect(groups.length).toBe(1);
    expect(groups[0].id).toBe('client-a');
    expect(groups[0].processes[0].verificationStatus).toBe('verified');
    expect(groups[0].processes[0].type).toBe(original.type);
    expect(groups[0].processes[0].registrationDate).toBe(original.registrationDate);
    expect(groups[0].processes[0].target.name).toBe('Vehículo verified-process');
    expect(groups[0].processes[0].clientRoute).toEqual([root, { id: 'client-a', fullName: 'Cliente Uno', affiliation_type_id: 'cliente' }]);
    expect(component.selectedProcess).toBe(original);
    expect(component.selectedProcess?.verificationStatus).toBe('verified');
    expect(fixture.nativeElement.querySelectorAll('article.process-client-group').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.process-row--verified')).not.toBeNull();
  });

  it('clears removed review fields in the row and open detail when returning to pending', () => {
    const original = {
      ...ownedProcess('reviewed-process', 'client-a'),
      verificationStatus: 'verified' as const,
      verifiedBy: { _id: 'reviewer', name: 'Revisor Anterior' },
      verifiedAt: '2026-09-30T12:00:00Z',
      verificationNote: 'Revisión anterior',
    };
    respond(0, [original]);
    component.showDetail(original);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-summary__status small')?.textContent)
      .toContain('Revisor Anterior');

    component.updateProcessVerificationStatus(original, 'pending');
    expect(updateVerification).toHaveBeenCalledOnceWith(original._id, 'pending');
    // JSON omits the fields removed by the backend's $unset operation.
    verification.next({ _id: original._id, verificationStatus: 'pending' } as ProcessItem);
    verification.complete();
    fixture.detectChanges();

    const group = component.clientProcessGroups[0];
    const row = group.processes[0];
    expect(group.id).toBe('client-a');
    expect(row).toBe(component.processes[0]);
    expect(row.target).toBe(original.target);
    expect(row.clientRoute).toBe(original.clientRoute);
    expect(component.selectedProcess).toBe(original);
    for (const item of [row, component.selectedProcess!]) {
      expect(item.verificationStatus).toBe('pending');
      expect(item.verifiedBy).toBeUndefined();
      expect(item.verifiedAt).toBeUndefined();
      expect(item.verificationNote).toBeUndefined();
    }
    expect(fixture.nativeElement.querySelector('.detail-summary__status small')).toBeNull();
    expect(fixture.nativeElement.querySelector('.verification-status-dropdown--detail')?.classList)
      .toContain('process-status--pending');
    expect(fixture.nativeElement.querySelector('.process-row--verified')).toBeNull();
  });

  it('reloads filtered history after verification and cancels pages that would skip a pending row', () => {
    component.selectedVerificationStatus = 'pending';
    component.applyFilters();
    const first = installations('client-a', 20);
    const original = first[0];
    respondGroups(1, [group('client-a', first, { total: 25, lastPage: 2 })], 30, 2);
    component.selectedProcess = original;
    component.loadMoreClientProcesses(component.clientProcessGroups[0]);
    component.loadMoreProcesses();
    const staleRows = rowRequests[0].response;
    const staleGroups = requests[2].response;
    component.updateProcessVerificationStatus(original, 'verified');
    verification.next({ _id: original._id, verificationStatus: 'verified' } as ProcessItem);
    verification.complete();

    expect(staleRows.observed).toBeFalse();
    expect(staleGroups.observed).toBeFalse();
    expect(requests[3].page).toBe(1);
    expect(requests[3].filters.verificationStatus).toBe('pending');
    expect(component.clientProcessGroups).toEqual([]);
    expect(component.processes).toEqual([]);
    expect(component.totalRecords).toBe(0);
    expect(component.selectedProcess).toBe(original);
    expect(component.selectedProcess?.verificationStatus).toBe('verified');
    expect(component.selectedProcess?.target.name).toBe('Vehículo client-a-0');

    const remaining = [...first.slice(1), ...installations('client-a', 5, 20)];
    respondGroups(3, [group('client-a', remaining.slice(0, 20), { total: 24, lastPage: 2 })]);
    staleRows.next({ data: installations('client-a', 4, 21), total: 24, page: 2, lastPage: 2 });
    staleGroups.next({ groups: [group('obsolete-client', [ownedProcess('obsolete', 'obsolete-client')])], total: 30, totalGroups: 2, page: 2, lastPage: 2 });
    component.loadMoreClientProcesses(component.clientProcessGroups[0]);
    respondRows(1, remaining.slice(20), 24, 2);

    expect(component.clientProcessGroups[0].processes).toEqual(remaining);
    expect(component.clientProcessGroups[0].total).toBe(24);
    expect(component.processes.map(row => row._id)).toContain('client-a-20');
    expect(component.processes.some(row => row._id === original._id)).toBeFalse();
  });

  it('keeps unfiltered history when only a draft verification filter is incompatible', () => {
    const original = ownedProcess('verified-process', 'client-a');
    respond(0, [original]);
    component.selectedVerificationStatus = 'pending';
    component.updateProcessVerificationStatus(original, 'verified');
    verification.next({ _id: original._id, verificationStatus: 'verified' } as ProcessItem);
    verification.complete();

    expect(requests.length).toBe(1);
    expect(component.clientProcessGroups[0].processes[0].verificationStatus).toBe('verified');
    expect(component.totalRecords).toBe(1);
  });

  it('renders one owner heading and hierarchy per card with a process table and no repeated client column', () => {
    const route = [root, distributor, { id: 'client-a', fullName: 'Cliente Uno' }];
    respond(0, [
      { ...ownedProcess('one', 'client-a'), clientRoute: route },
      { ...ownedProcess('two', 'client-a'), clientRoute: route },
    ]);
    const card: HTMLElement = fixture.nativeElement.querySelector('article.process-client-group');
    expect(card).not.toBeNull();
    expect(card.querySelector('.process-client-group__name')?.textContent).toContain('Cliente Uno');
    const routeText = (card.querySelector('nav.process-client-route')?.textContent || '').toLowerCase();
    expect(routeText).toContain('montao gps');
    expect(routeText).toContain('distribuidora norte');
    expect(routeText).toContain('cliente uno');
    expect(routeText.indexOf('montao gps')).toBeLessThan(routeText.indexOf('distribuidora norte'));
    expect(routeText.indexOf('distribuidora norte')).toBeLessThan(routeText.indexOf('cliente uno'));
    expect(card.querySelectorAll('p-table').length).toBe(1);
    expect(card.querySelectorAll('.p-datatable-tbody > tr').length).toBe(2);
    expect(card.querySelector('.column-client')).toBeNull();
    expect(card.querySelector('.process-client-cell')).toBeNull();
    expect(fixture.nativeElement.querySelector('.processes-table')).not.toBeNull();
  });

  for (const width of [1280, 390]) {
    it(`keeps client names and account paths inside a ${width}px container`, async () => {
      fixture.nativeElement.style.width = `${width}px`;
      const owner = ownedProcess('responsive', 'client-a', 'Comercializadora De Vehículos Y Servicios Del Este');
      owner.clientRoute = [
        root,
        { id: 'regional', fullName: 'Administración Regional De Servicios' },
        distributor,
        { id: 'reseller', fullName: 'Distribución Comercial En La Región Este' },
        { id: 'client-a', fullName: 'Comercializadora De Vehículos Y Servicios Del Este' },
      ];
      respond(0, [owner]);
      await fixture.whenStable();
      const card: HTMLElement = fixture.nativeElement.querySelector('article.process-client-group');
      const viewport: HTMLElement = fixture.nativeElement.querySelector('.processes-table');
      const name = card.querySelector('.process-client-group__name') as HTMLElement;
      const route = card.querySelector('nav.process-client-route') as HTMLElement;
      expect(card.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(viewport.clientWidth + 1);
      expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth + 1);
      expect(route.scrollWidth).toBeLessThanOrEqual(route.clientWidth + 1);
      if (width === 390) {
        const accountRows = Array.from(route.querySelectorAll('li'))
          .map(account => Math.round(account.getBoundingClientRect().top));
        expect(new Set(accountRows).size).toBeGreaterThan(1);
        const tableScroll = card.querySelector('.p-datatable-table-container, .p-datatable-wrapper') as HTMLElement;
        expect(tableScroll.scrollWidth).toBeGreaterThan(tableScroll.clientWidth);
        tableScroll.scrollLeft = 50;
        expect(tableScroll.scrollLeft).toBeGreaterThan(0);
      }
    });
  }
});

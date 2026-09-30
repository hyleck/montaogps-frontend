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
import { PaginatedProcessResponse, ProcessItem, ProcessesService } from '../../services/processes.service';
import { ProcessesComponent } from './processes.component';

describe('Processes grouped by client', () => {
  let fixture: ComponentFixture<ProcessesComponent>;
  let component: ProcessesComponent;
  let requests: Array<{ page: number; response: Subject<PaginatedProcessResponse> }>;
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
    verification = new Subject<ProcessItem>();
    updateVerification = jasmine.createSpy('updateVerificationStatus').and.returnValue(verification.asObservable());
    await TestBed.configureTestingModule({
      imports: [ProcessesModule, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ProcessesService, useValue: {
          getPaginated: (page: number) => {
            const response = new Subject<PaginatedProcessResponse>();
            requests.push({ page, response });
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

  function respond(index: number, data: ProcessItem[], total = data.length, lastPage = 1): void {
    requests[index].response.next({ data, total, page: requests[index].page, lastPage });
    requests[index].response.complete();
    fixture.detectChanges();
  }

  it('uses the last account in the route and keeps equally named clients and subaccounts separate', () => {
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
    respond(0, [parentRow, childRow, sameName]);

    const groups = component.clientProcessGroups;
    expect(groups.map(group => group.id)).toEqual(['owner-a', 'subaccount-a', 'owner-b']);
    expect(groups.map(group => group.name)).toEqual(['Comercio Central', 'Sucursal Este', 'Comercio Central']);
    expect(groups[1].route.map(account => account.id)).toEqual([
      root.id, distributor.id, owner.id, subaccount.id,
    ]);
    expect(groups[1].processes).toEqual([childRow]);
    expect(groups[0].contact).toContain('8095550100');
  });

  it('uses available owner IDs when the API has no route and groups unknown owners together', () => {
    respond(0, [
      process('parent-id', {
        target: { _id: 'target-parent', parent_id: 'actual-owner' },
        client: { _id: 'parent-client', subclient: { _id: 'sub-client' } },
      }),
      process('subclient-id', { client: { _id: 'parent-client', subclient: { _id: 'sub-client' } } }),
      process('client-id', { client: { _id: 'parent-client', name: 'Cliente' } }),
      process('unknown-a'),
      process('unknown-b', { client: { name: 'Nombre sin identificador' } }),
    ]);

    const groups = component.clientProcessGroups;
    expect(groups.map(group => group.id)).toEqual(['actual-owner', 'sub-client', 'parent-client', 'unassigned']);
    expect(groups[3].processes.map(row => row._id)).toEqual(['unknown-a', 'unknown-b']);
  });

  it('appends later-page rows to their existing client and preserves first-seen client and row order', () => {
    const first = ownedProcess('first', 'client-a');
    const second = ownedProcess('second', 'client-b', 'Cliente Dos');
    const third = ownedProcess('third', 'client-a');
    respond(0, [first, second, third], 5, 2);
    component.loadMoreProcesses();
    expect(requests.map(request => request.page)).toEqual([1, 2]);
    const fourth = ownedProcess('fourth', 'client-b', 'Cliente Dos');
    const fifth = ownedProcess('fifth', 'client-a');
    respond(1, [fourth, fifth], 5, 2);

    const groups = component.clientProcessGroups;
    expect(groups.map(group => group.id)).toEqual(['client-a', 'client-b']);
    expect(groups[0].processes).toEqual([first, third, fifth]);
    expect(groups[1].processes).toEqual([second, fourth]);
    expect(component.processes).toEqual([first, second, third, fourth, fifth]);
    expect(fixture.nativeElement.querySelectorAll('article.process-client-group').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.p-datatable-tbody > tr').length).toBe(5);
  });

  it('reuses the groups until a new processes array is supplied', () => {
    respond(0, [ownedProcess('first', 'client-a')]);
    const groups = component.clientProcessGroups;
    fixture.detectChanges();
    expect(component.clientProcessGroups).toBe(groups);

    const second = ownedProcess('second', 'client-a');
    component.processes = [...component.processes, second];
    expect(component.clientProcessGroups).not.toBe(groups);
    expect(component.clientProcessGroups[0].processes.map(row => row._id)).toEqual(['first', 'second']);
    expect(groups[0].processes.map(row => row._id)).toEqual(['first']);
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
    oldResponse.next({ data: [ownedProcess('late', 'old-client')], total: 3, page: 2, lastPage: 2 });
    respond(2, [ownedProcess('new', 'new-client', 'Cliente Nuevo')]);
    expect(component.clientProcessGroups.map(group => group.id)).toEqual(['new-client']);
    expect(component.clientProcessGroups[0].processes.map(row => row._id)).toEqual(['new']);
  });

  it('keeps enriched ownership and the selected object when verification returns a raw process', () => {
    const original = ownedProcess('verified-process', 'client-a');
    respond(0, [original]);
    component.selectedProcess = original;
    const previousGroups = component.clientProcessGroups;
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
    expect(groups).not.toBe(previousGroups);
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

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
import { ProcessItem, ProcessesService } from '../../services/processes.service';
import { ProcessesComponent } from './processes.component';

describe('Processes infinite scroll', () => {
  let fixture: ComponentFixture<ProcessesComponent>;
  let component: ProcessesComponent;
  let viewport: HTMLElement;
  let requests: Array<{ page: number; limit: number; filters: any; processLimit: number; response: Subject<ReturnType<typeof groupResponse>> }>;

  function rows(start: number, count: number): ProcessItem[] {
    return Array.from({ length: count }, (_, index) => ({
      _id: `process-${start + index}`, type: 22, readOnly: true,
      target: { _id: `target-${start + index}`, name: `Vehículo ${start + index}`, parent_id: `client-${Math.floor((start + index) / 2)}` },
      user: { _id: 'requester' }, creator: {}, description: 'Renovación pendiente',
      reference: `target-${start + index}`, before: {}, after: {},
      registrationDate: '2026-09-01T12:00:00Z', createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:00:00Z',
    }));
  }

  function groupResponse(data: ProcessItem[], total: number, page: number, lastPage: number) {
    const owners = [...new Set(data.map(row => String(row.target['parent_id'])))];
    return {
      groups: owners.map(id => {
        const processes = data.filter(row => row.target['parent_id'] === id);
        return { id, name: id, contact: '', route: [], total: processes.length,
          processes, page: 1, lastPage: 1 };
      }),
      total, totalGroups: Math.ceil(total / 2), page, lastPage,
    };
  }

  beforeEach(async () => {
    requests = [];
    await TestBed.configureTestingModule({
      imports: [ProcessesModule, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ProcessesService, useValue: {
          getClientGroups: (page: number, limit: number, filters: any, processLimit: number) => {
            const response = new Subject<ReturnType<typeof groupResponse>>();
            requests.push({ page, limit, filters, processLimit, response });
            return response.asObservable();
          },
          searchClients: () => of([]),
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
    viewport = fixture.nativeElement.querySelector('.processes-table');
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  function respond(index: number, data: ProcessItem[], total: number, lastPage: number): void {
    requests[index].response.next(groupResponse(data, total, requests[index].page, lastPage));
    requests[index].response.complete();
    fixture.detectChanges();
  }

  function metrics(height = 300, contentHeight = 2000): { height: number; contentHeight: number; top: number } {
    const dimensions = { height, contentHeight, top: 0 };
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, get: () => dimensions.height },
      scrollHeight: { configurable: true, get: () => dimensions.contentHeight },
      scrollTop: { configurable: true, get: () => dimensions.top, set: (value: number) => dimensions.top = value },
    });
    return dimensions;
  }

  async function renderFrame(): Promise<void> {
    await new Promise(resolve => requestAnimationFrame(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('loads all history initially and restores unbounded dates when filters are cleared', () => {
    expect(component.dateFrom).toBeNull();
    expect(component.dateTo).toBeNull();
    expect(requests[0].filters).toEqual({});
    component.dateFrom = new Date(2026, 8, 1);
    component.dateTo = new Date(2026, 8, 30);
    component.applyFilters();
    expect(requests[1].filters.dateFrom).toBe(component.dateFrom.toISOString());
    component.clearFilters();
    expect(component.dateFrom).toBeNull();
    expect(component.dateTo).toBeNull();
    expect(requests[2].filters).toEqual({});
  });

  it('uses the actual scroll container to append complete client cards without a global paginator', async () => {
    expect(requests.length).toBe(1);
    expect(requests[0].limit).toBe(10);
    expect(requests[0].processLimit).toBe(20);
    respond(0, rows(0, 20), 40, 2);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.p-paginator')).toBeNull();
    expect(getComputedStyle(viewport).overflowY).toBe('auto');
    expect(viewport.clientHeight).toBeGreaterThan(0);
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    expect(requests.length).toBe(1);
    viewport.scrollTop = viewport.scrollHeight;
    viewport.dispatchEvent(new Event('scroll'));
    expect(requests.map(request => request.page)).toEqual([1, 2]);
    expect(component.loadingMore).toBeTrue();
    expect(component.loading).toBeFalse();
    expect(component.processes.length).toBe(20);
    respond(1, rows(20, 20), 40, 2);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.p-datatable-tbody > tr').length).toBe(40);
    expect(component.hasMoreProcesses).toBeFalse();
    viewport.dispatchEvent(new Event('scroll'));
    expect(requests.length).toBe(2);
  });

  it('loads enough batches to fill a tall viewport and stops once scrolling is available', async () => {
    const dimensions = metrics(800, 400);
    respond(0, rows(0, 20), 80, 4);
    await renderFrame();
    expect(requests.map(request => request.page)).toEqual([1, 2]);
    dimensions.contentHeight = 1300;
    respond(1, rows(20, 20), 80, 4);
    await renderFrame();
    expect(requests.length).toBe(2);
    dimensions.height = 1400;
    window.dispatchEvent(new Event('resize'));
    await renderFrame();
    expect(requests.map(request => request.page)).toEqual([1, 2, 3]);
  });

  it('deduplicates overlapping client pages and concurrent scroll events', async () => {
    const dimensions = metrics();
    respond(0, rows(0, 20), 39, 2);
    dimensions.top = 1700;
    viewport.dispatchEvent(new Event('scroll'));
    viewport.dispatchEvent(new Event('scroll'));
    component.loadMoreProcesses();
    expect(requests.length).toBe(2);
    respond(1, rows(19, 20), 39, 2);
    await fixture.whenStable();
    expect(component.processes.length).toBe(39);
    expect(new Set(component.processes.map(process => process._id)).size).toBe(39);
  });

  it('keeps the applied search, client, types and date range while input drafts change', () => {
    metrics();
    component.searchQuery = '  Toyota  ';
    component.applyTemplate({ types: [22], client: { id: 'client-1', label: 'Cliente' },
      dateFrom: new Date(2027, 0, 1), dateTo: new Date(2027, 0, 31, 23, 59, 59, 999) });
    component.searchQuery = 'Toyota';
    component.applyFilters();
    const applied = requests[2];
    respond(2, rows(0, 20), 40, 2);
    component.searchQuery = 'unapplied';
    component.dateFrom = new Date(2030, 0, 1);
    component.selectedTypes.push(4);
    component.loadMoreProcesses();
    expect(requests[3].filters).toEqual(applied.filters);
    expect(requests[3].filters).toEqual({ types: [22], client: 'client-1', search: 'Toyota',
      dateFrom: '2027-01-01', dateTo: '2027-01-31' });
  });

  it('sends a midnight Hasta selection as an inclusive calendar day', () => {
    metrics();
    component.selectedClient = { id: 'client-1', label: 'Cliente' };
    component.selectedTypes = [22];
    component.dateFrom = new Date(2027, 0, 31, 0, 0, 0, 0);
    component.dateTo = new Date(2027, 0, 31, 0, 0, 0, 0);
    component.applyFilters();
    expect(requests[1].filters).toEqual({ types: [22], client: 'client-1', dateFrom: '2027-01-31', dateTo: '2027-01-31' });
    const lateExpiry = { ...rows(0, 1)[0], registrationDate: '2027-02-01T03:59:59.999Z' };
    respond(1, [lateExpiry], 1, 1);
    expect(component.processes).toEqual([lateExpiry]);
  });

  it('preserves the selected hours when filtering historical processes', () => {
    metrics();
    component.selectedTypes = [4];
    component.dateFrom = new Date(2027, 0, 31, 14, 30);
    component.dateTo = new Date(2027, 0, 31, 15, 45);
    component.applyFilters();
    expect(requests[1].filters).toEqual({ types: [4],
      dateFrom: component.dateFrom.toISOString(), dateTo: component.dateTo.toISOString() });
  });

  it('clears rows and scroll position and ignores an old page after filters change', () => {
    const dimensions = metrics();
    respond(0, rows(0, 20), 60, 3);
    dimensions.top = 1700;
    component.loadMoreProcesses();
    const oldRequest = requests[1].response;
    component.searchQuery = 'new search';
    component.applyFilters();
    expect(oldRequest.observed).toBeFalse();
    expect(component.processes).toEqual([]);
    expect(component.loading).toBeTrue();
    expect(component.loadingMore).toBeFalse();
    expect(viewport.scrollTop).toBe(0);
    expect(requests[2].page).toBe(1);
    oldRequest.next(groupResponse(rows(20, 20), 60, 2, 3));
    respond(2, rows(100, 1), 1, 1);
    expect(component.processes.map(process => process._id)).toEqual(['process-100']);
  });

  it('preserves loaded rows on a later-page error and retries that same page once requested', async () => {
    const dimensions = metrics();
    respond(0, rows(0, 20), 40, 2);
    dimensions.top = 1700;
    component.loadMoreProcesses();
    requests[1].response.error(new Error('Unavailable'));
    fixture.detectChanges();
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(requests.length).toBe(2);
    expect(component.processes.length).toBe(20);
    expect(component.loadingMore).toBeFalse();
    fixture.nativeElement.querySelector('.processes-load-retry').click();
    expect(requests[2].page).toBe(2);
    respond(2, rows(20, 20), 40, 2);
    expect(component.processes.length).toBe(40);
    expect(component.processesLoadError).toBe('');
  });

  it('retries an initial error and stops on an empty batch even if totals are stale', async () => {
    metrics(800, 400);
    requests[0].response.error(new Error('Unavailable'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.processes-empty-state')).toBeNull();
    component.retryProcesses();
    expect(requests[1].page).toBe(1);
    respond(1, [], 100, 5);
    await fixture.whenStable();
    expect(requests.length).toBe(2);
    expect(component.hasMoreProcesses).toBeFalse();
    expect(fixture.nativeElement.querySelector('.processes-empty-state')).not.toBeNull();
  });

  it('cancels an outstanding request and scheduled loading when destroyed', async () => {
    metrics(800, 400);
    respond(0, rows(0, 20), 40, 2);
    component.loadMoreProcesses();
    fixture.destroy();
    expect(requests[1].response.observed).toBeFalse();
    requests[1].response.next(groupResponse(rows(20, 20), 40, 2, 2));
    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(requests.length).toBe(2);
    expect(component.processes.length).toBe(20);
  });
});

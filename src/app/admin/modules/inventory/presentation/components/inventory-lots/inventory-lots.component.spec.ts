import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { InventoryLotPage, InventoryService } from '../../../../../../core/services/inventory.service';
import { InventoryLotsComponent } from './inventory-lots.component';

describe('Inventory lots', () => {
  let fixture: ComponentFixture<InventoryLotsComponent>;
  let component: InventoryLotsComponent;
  let inventory: jasmine.SpyObj<InventoryService>;
  const page: InventoryLotPage = {
    total: 1, total_quantity: 100, page: 1, lastPage: 1,
    data: [{ _id: 'lot-1', category: 'relay', name: 'Entrada agosto', quantity: 100,
      createdAt: '2026-08-28T12:00:00Z', balances: [
        { storage_id: { _id: 'warehouse-1', name: 'Almacén principal' }, quantity: 80 },
        { storage_id: null, quantity: 20 },
      ] }],
  };

  beforeEach(async () => {
    inventory = jasmine.createSpyObj<InventoryService>('InventoryService', ['getLots', 'createLot']);
    inventory.getLots.and.returnValue(of(page));
    inventory.createLot.and.returnValue(of(page.data[0]));
    await TestBed.configureTestingModule({
      imports: [InventoryLotsComponent, NoopAnimationsModule],
      providers: [{ provide: InventoryService, useValue: inventory }],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryLotsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('category', 'relay');
    fixture.componentRef.setInput('canCreate', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  it('shows separate quantities by warehouse without asking for serial identifiers', () => {
    expect(inventory.getLots).toHaveBeenCalledWith('relay', '', '', 1);
    expect(component.rows.map(row => [row.source_name, row.available])).toEqual([
      ['Almacén principal', 80], ['Sin asignar', 20],
    ]);
    const table = fixture.nativeElement.querySelector('table');
    expect(table.textContent).toContain('Entrada agosto');
    expect(table.textContent).not.toContain('IMEI');
    expect(fixture.nativeElement.querySelector('.lot-summary').textContent).toContain('100 unidades');
  });

  it('selects a partial quantity and its exact warehouse', () => {
    const emitted = spyOn(component.selectLot, 'emit');
    const row = component.rows[0];
    component.quantities[row.key] = 25;
    component.choose(row);
    expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ lot_id: 'lot-1', source_warehouse: 'warehouse-1', quantity: 25, available: 80 }));
  });

  it('supports assigning an unassigned lot', () => {
    const emitted = spyOn(component.selectLot, 'emit');
    component.choose(component.rows[1]);
    expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ source_warehouse: null, quantity: 1 }));
  });

  it('blocks fractional, empty, excessive and same-destination quantities', () => {
    const emitted = spyOn(component.selectLot, 'emit');
    const row = component.rows[0];
    for (const value of [0, -2, 1.5, 81, NaN]) {
      component.quantities[row.key] = value;
      component.choose(row);
      expect(component.validQuantity(row)).toBeFalse();
    }
    component.quantities[row.key] = 1;
    component.destination = row.source_warehouse;
    component.choose(row);
    expect(emitted).not.toHaveBeenCalled();
  });

  it('sends category, warehouse, search and pagination to the server', () => {
    component.category = '';
    component.filterCategory = 'cables';
    component.storage = 'unassigned';
    component.query = '  compra agosto  ';
    component.load(2);
    expect(inventory.getLots).toHaveBeenCalledWith('cables', 'unassigned', 'compra agosto', 2);
  });

  it('cancels a stale list request when another filter is selected', () => {
    const first = new Subject<InventoryLotPage>();
    const second = new Subject<InventoryLotPage>();
    inventory.getLots.and.returnValues(first, second);
    component.load();
    component.load();
    expect(first.observed).toBeFalse();
    second.next({ ...page, total_quantity: 7 });
    expect(component.totalQuantity).toBe(7);
  });

  it('registers a lot with quantity and warehouse and reloads the balances', () => {
    component.openNew();
    const requestId = component.draft.request_id;
    component.draft.name = ' Compra Relay ';
    component.draft.quantity = 50;
    component.draft.storage_id = 'warehouse-1';
    component.save();
    expect(inventory.createLot).toHaveBeenCalledWith(jasmine.objectContaining({ category: 'relay', name: 'Compra Relay', quantity: 50, storage_id: 'warehouse-1', request_id: requestId }));
    expect(component.formVisible).toBeFalse();
    expect(inventory.getLots).toHaveBeenCalledTimes(2);
  });

  it('prevents double submission and retains the request id after an uncertain failure', () => {
    const saving = new Subject<any>();
    inventory.createLot.and.returnValues(saving, throwError(() => ({ error: { message: 'Prueba de error' } })));
    component.openNew();
    component.draft.name = 'Entrada';
    component.save();
    component.save();
    expect(inventory.createLot).toHaveBeenCalledTimes(1);
    saving.error({ status: 0 });
    component.save();
    const calls = inventory.createLot.calls.allArgs();
    expect(calls[1][0].request_id).toBe(calls[0][0].request_id);
    expect(component.formVisible).toBeTrue();
    expect(component.formError).toContain('Prueba de error');
  });

  it('rejects invalid registration quantities before sending a request', () => {
    component.openNew();
    component.draft.name = 'Entrada';
    component.draft.quantity = 0.5;
    component.save();
    expect(inventory.createLot).not.toHaveBeenCalled();
    expect(component.formError).toContain('cantidad entera');
  });

  it('removes mutation controls for read-only users', () => {
    fixture.componentRef.setInput('canCreate', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lot-header button')).toBeNull();
    expect(fixture.nativeElement.querySelector('tbody button')).toBeNull();
    component.openNew();
    component.save();
    expect(component.formVisible).toBeFalse();
    expect(inventory.createLot).not.toHaveBeenCalled();
  });

  it('scrolls the table inside narrow layouts instead of overflowing the panel', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.style.width = '380px';
    const scroll = host.querySelector<HTMLElement>('.lot-table-scroll')!;
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
    expect(scroll.getBoundingClientRect().right).toBeLessThanOrEqual(host.getBoundingClientRect().right + 1);
    scroll.scrollLeft = scroll.scrollWidth;
    expect(scroll.scrollLeft).toBeGreaterThan(0);
  });

  it('renders the registration fields for the selected category', async () => {
    fixture.componentRef.setInput('category', 'cables');
    fixture.detectChanges();
    component.openNew();
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.nativeElement.querySelector('.lot-form');
    expect(form.textContent).toContain('Cantidad de Cables');
    expect(form.querySelector('select[name="newCategory"]').disabled).toBeTrue();
    expect(form.querySelector('input[name="quantity"]')).not.toBeNull();
    expect(form.querySelector('input[name="IMEI"]')).toBeNull();
  });
});

import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../../../../core/services/auth.service';
import { InventoryService } from '../../../../../../core/services/inventory.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { SystemService } from '../../../../../../core/services/system.service';
import { UserService } from '../../../../../../core/services/user.service';
import { PrimengModule } from '../../../../../../shareds/libraries/primeng/primeng.module';
import { InventoryComponent } from './inventory.component';

describe('Inventory warehouse dialog layout', () => {
  let fixture: ComponentFixture<InventoryComponent>;
  let dialog: HTMLElement;

  beforeEach(async () => {
    spyOn(InventoryComponent.prototype, 'ngOnInit').and.stub();
    await TestBed.configureTestingModule({
      declarations: [InventoryComponent],
      imports: [CommonModule, FormsModule, NoopAnimationsModule, TranslateModule.forRoot(), PrimengModule],
      providers: [
        provideRouter([]),
        { provide: InventoryService, useValue: {} },
        { provide: ProtocolsService, useValue: {} },
        { provide: AuthService, useValue: { hasPrivilege: () => true } },
        { provide: UserService, useValue: {} },
        { provide: SystemService, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryComponent);
    fixture.componentInstance.loading = false;
    fixture.componentInstance.warehouses = Array.from({ length: 20 }, (_, index) => ({
      _id: `warehouse-${index}`,
      name: `Almacén ${index} con un nombre suficientemente largo para comprobar el espacio`,
      description: 'Descripción del almacén',
      min_quantity: 10,
      stock: index,
      simcard_stock: index + 1,
      access_users: ['usuario.con.nombre.muy.largo@example.com'],
      created_by: { name: 'Administración', last_name: 'Con un nombre largo' },
    })) as any;
    fixture.componentInstance.warehouseDialogVisible = true;
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenRenderingDone();
    dialog = fixture.nativeElement.querySelector('.warehouse-modal-toolbar').closest('.p-dialog');
    dialog.style.setProperty('--globalColorBorderDark', '#cbd5e1');
    dialog.style.setProperty('--managementColorInputSearch', '#f1f5f9');
    // Exercise panel widths independently of the headless runner's viewport.
    dialog.style.maxWidth = 'none';
    dialog.style.flexShrink = '0';
  });

  afterEach(() => fixture?.destroy());

  function expectInside(element: Element, container: Element): void {
    const rect = element.getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    expect(rect.left).withContext(element.className).toBeGreaterThanOrEqual(bounds.left - 1);
    expect(rect.right).withContext(element.className).toBeLessThanOrEqual(bounds.right + 1);
  }

  for (const width of [1360, 1180, 760, 400]) {
    it(`keeps quantities, status, audit and actions inside their columns at ${width}px`, () => {
      dialog.style.width = `${width}px`;
      expect(Math.round(dialog.getBoundingClientRect().width)).toBe(width);
      const table = dialog.querySelector<HTMLTableElement>('.warehouse-table')!;
      const row = table.tBodies[0].rows[0];

      for (const cell of Array.from(row.cells)) {
        for (const child of Array.from(cell.children)) expectInside(child, cell);
      }
      for (const heading of Array.from(table.tHead!.rows[0].cells)) {
        expect(heading.scrollWidth).withContext(heading.textContent || '').toBeLessThanOrEqual(heading.clientWidth + 1);
      }
      const stocks = Array.from(row.querySelectorAll<HTMLElement>('.warehouse-table__stock-button'));
      expect(stocks[0].getBoundingClientRect().right).toBeLessThan(stocks[1].getBoundingClientRect().left);
      expect(stocks[1].getBoundingClientRect().right).toBeLessThan(row.querySelector('.warehouse-table__status')!.getBoundingClientRect().left);
    });
  }

  it('uses one search border and keeps the input and toolbar inside a narrow dialog', () => {
    dialog.style.width = '400px';
    const toolbar = dialog.querySelector<HTMLElement>('.warehouse-modal-toolbar')!;
    const search = toolbar.querySelector<HTMLElement>('.warehouse-modal-search')!;
    const input = search.querySelector<HTMLInputElement>('input')!;

    expect(getComputedStyle(input).borderLeftWidth).toBe('0px');
    expect(getComputedStyle(input).boxShadow).toBe('none');
    expectInside(input, search);
    expectInside(search, toolbar);
    expectInside(toolbar.querySelector('button.p-button')!, toolbar);
  });

  it('scrolls the table horizontally while keeping both actions accessible', () => {
    dialog.style.width = '760px';
    const scroll = dialog.querySelector<HTMLElement>('.warehouse-table-container')!;
    const actions = scroll.querySelector<HTMLElement>('tbody .warehouse-table__actions')!;

    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
    for (const button of Array.from(actions.querySelectorAll('button'))) expectInside(button, scroll);
    scroll.scrollLeft = scroll.scrollWidth;
    expect(scroll.scrollLeft).toBeGreaterThan(0);
    for (const button of Array.from(actions.querySelectorAll('button'))) expectInside(button, scroll);
    expect(scroll.closest('.p-dialog-content')!.scrollLeft).toBe(0);
  });

  it('keeps the table scrollable vertically without hiding the search toolbar', () => {
    const scroll = dialog.querySelector<HTMLElement>('.warehouse-table-container')!;
    const toolbar = dialog.querySelector<HTMLElement>('.warehouse-modal-toolbar')!;
    const originalTop = toolbar.getBoundingClientRect().top;

    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    scroll.scrollTop = scroll.scrollHeight;

    expect(scroll.scrollTop).toBeGreaterThan(0);
    expect(toolbar.getBoundingClientRect().top).toBe(originalTop);
    expect(scroll.querySelector('tbody tr:last-child')!.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(scroll.getBoundingClientRect().bottom + 1);
  });

  it('preserves the equipment, SIM, edit and delete actions on each warehouse', () => {
    const equipment = spyOn(fixture.componentInstance, 'filterByWarehouse');
    const sims = spyOn(fixture.componentInstance, 'filterSimcardsByWarehouse');
    const edit = spyOn(fixture.componentInstance, 'editWarehouse');
    const remove = spyOn(fixture.componentInstance, 'deleteWarehouse');
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('tbody tr:first-child .warehouse-table__stock-button');

    buttons[0].click();
    buttons[1].click();
    dialog.querySelector<HTMLButtonElement>('tbody tr:first-child [aria-label="Editar almacén"]')!.click();
    dialog.querySelector<HTMLButtonElement>('tbody tr:first-child [aria-label="Eliminar almacén"]')!.click();

    const warehouse = fixture.componentInstance.orderedWarehouses[0];
    expect(equipment).toHaveBeenCalledWith(warehouse);
    expect(sims).toHaveBeenCalledWith(warehouse);
    expect(edit).toHaveBeenCalledWith(warehouse);
    expect(remove).toHaveBeenCalledWith(warehouse);
  });
});

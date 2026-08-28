import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { InventoryLotDetails, InventoryLotPage, InventoryService } from '../../../../../../core/services/inventory.service';
import { InventoryLotsComponent } from './inventory-lots.component';

describe('Inventory lot management', () => {
  let fixture: ComponentFixture<InventoryLotsComponent>;
  let component: InventoryLotsComponent;
  let inventory: jasmine.SpyObj<InventoryService>;
  let detail: InventoryLotDetails;
  const page: InventoryLotPage = {
    page: 1, lastPage: 1, total: 1, total_quantity: 20,
    data: [{ _id: 'lot-1', category: 'relay', name: 'Entrada agosto', quantity: 100,
      balances: [{ storage_id: null, quantity: 20 }] }],
  };

  beforeEach(async () => {
    detail = { ...page.data[0], description: 'Compra', version: 7, stock_locked: false, pending_transfer: false,
      balances: [{ storage_id: { _id: 'warehouse-1', name: 'Almacén principal' }, quantity: 100 }] };
    inventory = jasmine.createSpyObj('InventoryService', ['getLots', 'getLot', 'createLot', 'updateLot', 'deleteLot']);
    inventory.getLots.and.returnValue(of(page));
    inventory.getLot.and.callFake(() => of(detail));
    inventory.updateLot.and.returnValue(of(detail));
    inventory.deleteLot.and.returnValue(of({ id: detail._id, deleted: true }));
    await TestBed.configureTestingModule({
      imports: [InventoryLotsComponent, NoopAnimationsModule],
      providers: [{ provide: InventoryService, useValue: inventory }],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryLotsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('category', 'relay');
    fixture.componentRef.setInput('warehouses', [{ _id: 'warehouse-1', name: 'Almacén principal' }]);
    fixture.componentRef.setInput('canUpdate', true);
    fixture.componentRef.setInput('canDelete', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());
  const element = (selector: string): HTMLElement => fixture.nativeElement.querySelector(selector);
  async function render(): Promise<void> { fixture.detectChanges(); await fixture.whenStable(); }

  it('shows edit/delete actions independently of the registration permission', () => {
    expect(element('.lot-edit')).not.toBeNull();
    expect(element('.lot-delete')).not.toBeNull();
    expect(element('.lot-header button')).toBeNull();
    expect(element('.lot-button--send')).toBeNull();
    expect(element('thead').textContent).toContain('Acciones');
  });

  it('loads the full fresh lot for editing instead of the warehouse-filtered quantity', async () => {
    element('.lot-edit').click();
    await render();
    expect(inventory.getLot).toHaveBeenCalledWith('lot-1');
    expect(component.draft).toEqual({ category: 'relay', name: 'Entrada agosto', quantity: 100, storage_id: 'warehouse-1', description: 'Compra', request_id: '' });
    expect(element('.p-dialog-header').textContent).toContain('Editar lote');
    expect((element('input[name="quantity"]') as HTMLInputElement).disabled).toBeFalse();
    expect((element('select[name="newCategory"]') as HTMLSelectElement).disabled).toBeFalse();
  });

  it('updates an unused lot using its version, corrected quantity, category and warehouse', () => {
    component.openEdit(component.rows[0]);
    component.draft = { ...component.draft, name: ' Cables nuevos ', category: 'cables', quantity: 140, storage_id: null, description: 'Nueva compra' };
    component.save();
    expect(inventory.updateLot).toHaveBeenCalledWith('lot-1', { version: 7, name: 'Cables nuevos', category: 'cables', quantity: 140, storage_id: null, description: 'Nueva compra' });
    expect(inventory.createLot).not.toHaveBeenCalled();
    expect(component.formVisible).toBeFalse();
    expect(component.actionSuccess).toContain('actualizado');
  });

  it('locks stock editing after movements and sends only name and description', async () => {
    detail.stock_locked = true;
    detail.balances = [{ storage_id: { _id: 'warehouse-1', name: 'Principal' }, quantity: 80 }, { storage_id: null, quantity: 20 }];
    component.openEdit(component.rows[0]);
    await render();
    expect((element('input[name="quantity"]') as HTMLInputElement).disabled).toBeTrue();
    expect((element('select[name="newCategory"]') as HTMLSelectElement).disabled).toBeTrue();
    expect(element('select[name="initialStorage"]')).toBeNull();
    expect(element('.lot-distribution').textContent).toContain('Principal');
    expect(element('.lot-distribution').textContent).toContain('Sin asignar');
    component.draft.name = 'Referencia corregida';
    component.save();
    expect(inventory.updateLot).toHaveBeenCalledWith('lot-1', { version: 7, name: 'Referencia corregida', description: 'Compra' });
  });

  it('asks for explicit confirmation and shows all warehouse balances before deleting', async () => {
    detail.balances = [{ storage_id: { _id: 'warehouse-1', name: 'Principal' }, quantity: 80 }, { storage_id: null, quantity: 20 }];
    element('.lot-delete').click();
    await render();
    const dialog = element('.inventory-lot-delete-dialog');
    expect(dialog.textContent).toContain('100 unidades en total');
    expect(dialog.textContent).toContain('Principal');
    expect(dialog.textContent).toContain('80 unidades');
    expect(dialog.textContent).toContain('20 unidades');
    expect(dialog.textContent).toContain('conservarán su historial');
    expect(inventory.deleteLot).not.toHaveBeenCalled();
    element('.lot-form-footer button').click();
    expect(component.deleteVisible).toBeFalse();
    expect(inventory.deleteLot).not.toHaveBeenCalled();
  });

  it('deletes only the confirmed lot with its latest version and refreshes the list', async () => {
    component.openDelete(component.rows[0]);
    await render();
    element('.lot-confirm-delete').click();
    await render();
    expect(inventory.deleteLot).toHaveBeenCalledWith('lot-1', 7);
    expect(component.deleteVisible).toBeFalse();
    expect(component.deletingLot).toBeNull();
    expect(inventory.getLots).toHaveBeenCalledTimes(2);
    expect(element('.lot-action-notice').textContent).toContain('historial de conduces se conserva');
  });

  it('disables deletion and explains why when a shipment is pending', async () => {
    detail.pending_transfer = true;
    component.openDelete(component.rows[0]);
    await render();
    expect((element('.lot-confirm-delete') as HTMLButtonElement).disabled).toBeTrue();
    expect(element('.inventory-lot-delete-dialog [role="alert"]').textContent).toContain('conduce pendiente');
    component.confirmDelete();
    expect(inventory.deleteLot).not.toHaveBeenCalled();
  });

  it('keeps the dialog and displays backend errors rather than claiming deletion', async () => {
    inventory.deleteLot.and.returnValue(throwError(() => ({ error: { message: 'El lote cambió durante el traslado.' } })));
    component.openDelete(component.rows[0]);
    component.confirmDelete();
    await render();
    expect(component.deleteVisible).toBeTrue();
    expect(component.deleting).toBeFalse();
    expect(element('.inventory-lot-delete-dialog [role="alert"]').textContent).toContain('cambió durante el traslado');
    expect(component.actionSuccess).toBe('');
  });

  it('prevents double deletion while the first request is pending', () => {
    const pending = new Subject<{ id: string; deleted: boolean }>();
    inventory.deleteLot.and.returnValue(pending);
    component.openDelete(component.rows[0]);
    component.confirmDelete();
    component.confirmDelete();
    component.openEdit(component.rows[0]);
    expect(inventory.deleteLot).toHaveBeenCalledTimes(1);
    expect(inventory.getLot).toHaveBeenCalledTimes(1);
    pending.next({ id: 'lot-1', deleted: true });
    expect(component.deleting).toBeFalse();
  });

  it('prevents duplicate edits and retains draft data after a version conflict', () => {
    const pending = new Subject<any>();
    inventory.updateLot.and.returnValue(pending);
    component.openEdit(component.rows[0]);
    component.draft.name = 'Nueva referencia';
    component.save(); component.save();
    expect(inventory.updateLot).toHaveBeenCalledTimes(1);
    pending.error({ error: { message: 'El lote cambió. Actualiza sus datos.' } });
    expect(component.formVisible).toBeTrue();
    expect(component.draft.name).toBe('Nueva referencia');
    expect(component.formError).toContain('Actualiza');
  });

  it('returns to the last available page after deleting its only row', () => {
    component.openDelete(component.rows[0]);
    component.page = 2;
    inventory.getLots.calls.reset();
    component.confirmDelete();
    expect(inventory.getLots.calls.allArgs()).toEqual([['relay', '', '', 2], ['relay', '', '', 1]]);
    expect(component.page).toBe(1);
  });

  it('does not open a dialog with stale data when fetching the lot fails', async () => {
    inventory.getLot.and.returnValue(throwError(() => ({ error: { message: 'El lote fue eliminado' } })));
    component.openEdit(component.rows[0]);
    await render();
    expect(component.formVisible).toBeFalse();
    expect(component.detailsLoadingId).toBe('');
    expect(element('[role="alert"]').textContent).toContain('fue eliminado');
  });

  it('cancels an older detail request before opening a different action', () => {
    const old = new Subject<InventoryLotDetails>();
    inventory.getLot.and.returnValues(old, of(detail));
    component.openEdit(component.rows[0]);
    component.openDelete(component.rows[0]);
    expect(old.observed).toBeFalse();
    expect(component.formVisible).toBeFalse();
    expect(component.deleteVisible).toBeTrue();
  });

  it('hides and guards each action when its permission is absent', () => {
    fixture.componentRef.setInput('canUpdate', false);
    fixture.componentRef.setInput('canDelete', false);
    fixture.detectChanges();
    expect(element('.lot-edit-actions')).toBeNull();
    component.openEdit(component.rows[0]);
    component.openDelete(component.rows[0]);
    expect(inventory.getLot).not.toHaveBeenCalled();
    expect(inventory.updateLot).not.toHaveBeenCalled();
    expect(inventory.deleteLot).not.toHaveBeenCalled();
  });

  it('keeps edit and delete out of the conduce picker even with management privileges', () => {
    fixture.componentRef.setInput('canCreate', true);
    fixture.componentRef.setInput('picker', true);
    fixture.detectChanges();
    expect(element('.lot-edit-actions')).toBeNull();
    expect(element('.lot-button--send').textContent).toContain('Agregar');
    component.openEdit(component.rows[0]);
    component.openDelete(component.rows[0]);
    expect(inventory.getLot).not.toHaveBeenCalled();
  });
});

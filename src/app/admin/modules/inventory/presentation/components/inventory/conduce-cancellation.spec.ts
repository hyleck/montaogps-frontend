import { of, Subject, throwError } from 'rxjs';
import { InventoryComponent } from './inventory.component';

describe('Conduce cancellation confirmation', () => {
  let component: InventoryComponent;
  let api: any;
  const preview = { conduce_id: 'shipment', conduce_number: 'CND-123', status: 'completed', can_cancel: true, preview_token: 'snapshot-a', blockers: [], movements: [] };
  const row = () => ({ _id: 'shipment', status: 'completed', destination_warehouse: 'warehouse' });
  beforeEach(() => {
    component = Object.create(InventoryComponent.prototype);
    api = {
      previewConduceCancellation: jasmine.createSpy().and.returnValue(of({ ...preview })),
      cancelConduce: jasmine.createSpy().and.returnValue(of({ status: 'cancelled' })),
    };
    Object.assign(component, {
      inventoryService: api, messageService: { add: jasmine.createSpy() },
      cancellationSaving: false, cancellationLoading: false, cancellationRequest: 0, lotRefreshKey: 0,
    });
    spyOn(component, 'canUpdateInventory').and.returnValue(true);
    spyOn(component, 'loadConduces'); spyOn(component, 'loadWarehouses'); spyOn(component, 'searchAllInventory'); spyOn(component, 'searchAllSimcards');
  });

  it('loads a review without cancelling until the user confirms', () => {
    component.openConduceCancellation(row());
    expect(component.cancellationDialogVisible).toBeTrue();
    expect(api.previewConduceCancellation).toHaveBeenCalledWith('shipment');
    expect(api.cancelConduce).not.toHaveBeenCalled();
    component.cancellationReason = 'Destino incorrecto';
    component.confirmConduceCancellation();
    expect(api.cancelConduce).toHaveBeenCalledWith('shipment', 'snapshot-a', 'Destino incorrecto');
    expect(component.cancellationDialogVisible).toBeFalse();
    expect(component.loadWarehouses).toHaveBeenCalled();
  });

  it('does not allow blocked movements or read-only users to cancel', () => {
    api.previewConduceCancellation.and.returnValue(of({ ...preview, can_cancel: false, blockers: ['Movimiento posterior'] }));
    component.openConduceCancellation(row());
    component.confirmConduceCancellation();
    expect(api.cancelConduce).not.toHaveBeenCalled();
    (component.canUpdateInventory as jasmine.Spy).and.returnValue(false);
    component.cancellationPreview = { ...preview, can_cancel: true };
    component.confirmConduceCancellation();
    expect(api.cancelConduce).not.toHaveBeenCalled();
  });

  it('waits for persistence and ignores duplicate confirmation', () => {
    const response = new Subject<any>();
    api.cancelConduce.and.returnValue(response);
    component.openConduceCancellation(row());
    component.confirmConduceCancellation();
    component.confirmConduceCancellation();
    expect(api.cancelConduce).toHaveBeenCalledTimes(1);
    expect(component.cancellationDialogVisible).toBeTrue();
    expect(component.loadWarehouses).not.toHaveBeenCalled();
    response.next({ status: 'cancelled' });
    expect(component.cancellationDialogVisible).toBeFalse();
  });

  it('refreshes a conflict and requires a fresh explicit confirmation, keeping the reason', () => {
    api.cancelConduce.and.returnValue(throwError(() => ({ status: 409, error: { message: 'Cambió el inventario' } })));
    component.openConduceCancellation(row());
    component.cancellationReason = 'Mi motivo';
    api.previewConduceCancellation.and.returnValue(of({ ...preview, preview_token: 'snapshot-b' }));
    component.confirmConduceCancellation();
    expect(component.cancellationDialogVisible).toBeTrue();
    expect(component.cancellationSaving).toBeFalse();
    expect(component.cancellationError).toContain('Cambió');
    expect(component.cancellationReason).toBe('Mi motivo');
    expect(component.cancellationPreview?.preview_token).toBe('snapshot-b');
    expect(api.cancelConduce).toHaveBeenCalledTimes(1);
  });

  it('keeps confirmation disabled after a preview network failure and supports retry', () => {
    api.previewConduceCancellation.and.returnValue(throwError(() => ({ status: 0 })));
    component.openConduceCancellation(row());
    component.confirmConduceCancellation();
    expect(component.cancellationPreview).toBeNull();
    expect(api.cancelConduce).not.toHaveBeenCalled();
    api.previewConduceCancellation.and.returnValue(of(preview));
    component.refreshCancellationPreview();
    expect(component.cancellationPreview?.can_cancel).toBeTrue();
  });

  it('does not apply a late preview response to a different conduce', () => {
    const old = new Subject<any>();
    api.previewConduceCancellation.and.returnValue(old);
    component.openConduceCancellation(row());
    api.previewConduceCancellation.and.returnValue(of({ ...preview, conduce_id: 'other' }));
    component.openConduceCancellation({ ...row(), _id: 'other' });
    old.next(preview);
    expect(component.cancellationPreview?.conduce_id).toBe('other');
  });

  it('distinguishes cancelled and interrupted cancellation states from pending shipments', () => {
    expect(component.conduceStatusLabel({ ...row(), status: 'cancelled' })).toBe('Cancelado');
    expect(component.conduceStatusLabel({ ...row(), status: 'cancelling' })).toBe('Cancelación pendiente');
  });
});

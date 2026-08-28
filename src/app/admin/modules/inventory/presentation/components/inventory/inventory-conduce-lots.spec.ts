import { of, Subject, throwError } from 'rxjs';
import { ShippingLotSelection } from '../../../../../../core/services/inventory.service';
import { InventoryComponent } from './inventory.component';

describe('Inventory conduces with lots', () => {
  let component: InventoryComponent;
  let api: any;
  const row = (quantity = 20): ShippingLotSelection => ({ lot_id: 'lot-1', source_warehouse: 'source', source_name: 'Origen', category: 'relay', name: 'Entrada', quantity, available: 100 });
  beforeEach(() => {
    component = Object.create(InventoryComponent.prototype);
    api = { createConduce: jasmine.createSpy().and.returnValue(of({ status: 'completed' })), resumeConduce: jasmine.createSpy().and.returnValue(of({ status: 'completed' })) };
    Object.assign(component, {
      inventoryService: api, authService: { hasPrivilege: () => true },
      messageService: { add: jasmine.createSpy() },
      shippingDevices: [], shippingSimcards: [], shippingLots: [],
      shippingDestinationWarehouse: 'destination', shippingDescription: '',
      shippingRequestId: 'request-1', shippingSubmittedPayload: null,
      isCreatingConduce: false, shippingDialogVisible: false,
      resumingConduceId: null, lotRefreshKey: 0,
    });
    spyOn(component, 'loadWarehouses');
    spyOn(component, 'loadConduces');
  });

  it('creates a lot-only conduce without a GPS, SIM or unit barcode', () => {
    component.shippingLots = [row()];
    component.confirmConduce();
    expect(api.createConduce).toHaveBeenCalledWith({ destination_warehouse: 'destination', request_id: 'request-1', description: '', devices: [], simcards: [], lots: [{ lot_id: 'lot-1', source_warehouse: 'source', quantity: 20 }] });
    expect(component.shippingDialogVisible).toBeFalse();
    expect(component.shippingLots).toEqual([]);
    expect(component.lotRefreshKey).toBe(1);
  });

  it('allows mixing Relay, Cables, GPS and SIM cards in one shipment', () => {
    component.shippingLots = [row(), { ...row(10), lot_id: 'cable-lot', category: 'cables', source_warehouse: null }];
    component.shippingDevices = [{ _id: 'gps-1', storage_id: 'source' } as any];
    component.shippingSimcards = [{ _id: 'sim-1', storage_id: 'source' } as any];
    component.confirmConduce();
    const payload = api.createConduce.calls.mostRecent().args[0];
    expect(payload.devices).toEqual(['gps-1']);
    expect(payload.simcards).toEqual(['sim-1']);
    expect(payload.lots.length).toBe(2);
    expect(payload.lots[1]).toEqual({ lot_id: 'cable-lot', source_warehouse: null, quantity: 10 });
  });

  it('merges quantities of the same lot and origin without exceeding stock', () => {
    component.addLotToShipping(row(60));
    component.addLotToShipping(row(20));
    component.addLotToShipping(row(30));
    expect(component.shippingLots.length).toBe(1);
    expect(component.shippingLots[0].quantity).toBe(80);
    expect(component.shippingDialogVisible).toBeTrue();
  });

  it('keeps quantities from different warehouses separate', () => {
    component.addLotToShipping(row());
    component.addLotToShipping({ ...row(), source_warehouse: null });
    expect(component.shippingLots.length).toBe(2);
  });

  it('rejects overdrawn or fractional quantities and a same-warehouse transfer', () => {
    for (const quantity of [0, 0.5, 101]) {
      component.shippingLots = [row(quantity)];
      component.confirmConduce();
    }
    component.shippingLots = [{ ...row(), source_warehouse: 'destination' }];
    component.confirmConduce();
    expect(api.createConduce).not.toHaveBeenCalled();
  });

  it('removes products already located at a newly selected destination', () => {
    component.shippingLots = [row()];
    component.onShippingDestinationChange('source');
    expect(component.shippingLots).toEqual([]);
  });

  it('does not submit or close twice while awaiting a conduce', () => {
    api.createConduce.and.returnValue(new Subject());
    component.shippingDialogVisible = true;
    component.shippingLots = [row()];
    component.confirmConduce();
    component.confirmConduce();
    component.hideShippingDialog();
    expect(api.createConduce).toHaveBeenCalledTimes(1);
    expect(component.shippingDialogVisible).toBeTrue();
  });

  it('retries an uncertain shipment with the identical request and quantities', () => {
    api.createConduce.and.returnValue(throwError(() => ({ status: 0 })));
    component.shippingLots = [row()];
    component.confirmConduce();
    component.addLotToShipping(row());
    component.onShippingDestinationChange('other');
    component.confirmConduce();
    const calls = api.createConduce.calls.allArgs();
    expect(calls[1][0]).toBe(calls[0][0]);
    expect(calls[1][0].lots[0].quantity).toBe(20);
    expect(calls[1][0].destination_warehouse).toBe('destination');
  });

  it('resumes the existing conduce instead of creating another shipment', () => {
    component.resumeLotConduce({ _id: 'conduce-1', destination_warehouse: 'destination', status: 'pending' });
    expect(api.resumeConduce).toHaveBeenCalledWith('conduce-1');
    expect(api.createConduce).not.toHaveBeenCalled();
    expect(component.loadWarehouses).toHaveBeenCalled();
  });

  it('keeps read-only users from mutating stock', () => {
    spyOn(component, 'canCreateInventory').and.returnValue(false);
    component.addLotToShipping(row());
    component.shippingLots = [row()];
    component.confirmConduce();
    component.resumeLotConduce({ _id: 'conduce-1', destination_warehouse: 'destination' });
    expect(api.createConduce).not.toHaveBeenCalled();
    expect(api.resumeConduce).not.toHaveBeenCalled();
  });
});

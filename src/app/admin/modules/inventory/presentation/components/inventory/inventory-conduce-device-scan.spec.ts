import { of, Subject, throwError } from 'rxjs';
import { InventoryComponent } from './inventory.component';

describe('Conduce barcode scans', () => {
  let component: InventoryComponent;
  let api: any;
  const device = { _id: 'tag-id', IMEI: '000008826030231', Protocol: { name: 'MTAG-A' },
    package: { _id: 'package-id' }, storage_id: { _id: 'source' } };
  beforeEach(() => {
    component = Object.create(InventoryComponent.prototype);
    api = { findExactDevice: jasmine.createSpy().and.returnValue(of(device)) };
    Object.assign(component, { inventoryService: api, messageService: { add: jasmine.createSpy() },
      shippingDeviceInput: '8826030231', shippingDevices: [], shippingDestinationWarehouse: 'destination' });
  });

  it('adds the canonical tag returned for the short barcode', () => {
    component.addShippingDevice();
    expect(api.findExactDevice).toHaveBeenCalledWith('8826030231');
    expect(component.shippingDevices).toEqual([device as any]);
    expect(component.shippingDeviceInput).toBe('');
  });

  it('does not add the same inventory twice from short and complete scans', () => {
    component.addShippingDevice();
    component.shippingDeviceInput = '8826030231';
    component.addShippingDevice();
    component.shippingDeviceInput = device.IMEI;
    component.addShippingDevice();
    expect(component.shippingDevices.length).toBe(1);
  });

  it('deduplicates overlapping scans and preserves the next barcode being typed', () => {
    const pending = new Subject<any>();
    api.findExactDevice.and.returnValue(pending);
    component.addShippingDevice();
    component.addShippingDevice();
    component.shippingDeviceInput = '7260301010';
    pending.next(device);
    expect(component.shippingDevices.length).toBe(1);
    expect(component.shippingDeviceInput).toBe('7260301010');
  });

  it('keeps the destination warehouse restriction', () => {
    component.shippingDestinationWarehouse = 'source';
    component.addShippingDevice();
    expect(component.shippingDevices).toEqual([]);
    expect((component as any).messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Traslado no permitido' }));
  });

  it('opens package assignment for a found device without a package', () => {
    const unpackaged = { ...device, package: null };
    api.findExactDevice.and.returnValue(of(unpackaged));
    component.addShippingDevice();
    expect(component.assignPackageDialogVisible).toBeTrue();
    expect(component.deviceToAssignPackage).toBe(unpackaged as any);
    expect(component.shippingDevices).toEqual([]);
  });

  it('does not add missing or ambiguous inventory', () => {
    api.findExactDevice.and.returnValue(of(null));
    component.addShippingDevice();
    expect((component as any).messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'No encontrado' }));
    api.findExactDevice.and.returnValue(throwError(() => ({ error: { message: 'El código coincide con varios registros.' } })));
    component.addShippingDevice();
    expect(component.shippingDevices).toEqual([]);
    expect((component as any).messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ detail: 'El código coincide con varios registros.' }));
  });
});

describe('Conduce simcard scans', () => {
  let component: InventoryComponent;
  let api: any;
  const simcard = { _id: 'sim-id', iccid: '8097797106', idsim: '2510290351225', sim_company: 'nacionales', storage_id: { _id: 'source' } };
  const message = () => (component as any).messageService.add;
  beforeEach(() => {
    component = Object.create(InventoryComponent.prototype);
    api = { findSimcardsByIdentifier: jasmine.createSpy().and.returnValue(of([simcard])) };
    Object.assign(component, { inventoryService: api, messageService: { add: jasmine.createSpy() },
      shippingSimcardInput: '2510290351225', shippingSimcards: [], shippingDestinationWarehouse: 'destination' });
  });

  it('adds a national SIM scanned by its ID SIM', () => {
    component.addShippingSimcard();
    expect(api.findSimcardsByIdentifier).toHaveBeenCalledWith('2510290351225');
    expect(component.shippingSimcards).toEqual([simcard as any]);
    expect(component.shippingSimcardInput).toBe('');
  });

  it('does not add the same SIM from its ID SIM and its number', () => {
    component.addShippingSimcard();
    component.shippingSimcardInput = '809-779-7106';
    component.addShippingSimcard();
    expect(component.shippingSimcards.length).toBe(1);
  });

  it('does not add missing or ambiguous SIMs', () => {
    api.findSimcardsByIdentifier.and.returnValue(of([]));
    component.addShippingSimcard();
    expect(message()).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'No encontrada' }));
    api.findSimcardsByIdentifier.and.returnValue(of([simcard, { ...simcard, _id: 'other' }]));
    component.addShippingSimcard();
    expect(message()).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Código ambiguo' }));
    expect(component.shippingSimcards).toEqual([]);
  });

  it('keeps the destination warehouse restriction', () => {
    component.shippingDestinationWarehouse = 'source';
    component.addShippingSimcard();
    expect(component.shippingSimcards).toEqual([]);
    expect(message()).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Traslado no permitido' }));
  });
});

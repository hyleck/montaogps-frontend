import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../../../../../core/services/auth.service';
import { InventoryService } from '../../../../../../core/services/inventory.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { PrimengModule } from '../../../../../../shareds/libraries/primeng/primeng.module';
import { DeviceLabelPipe } from '../../../../../../shareds/pipes/device-label.pipe';
import { InventoryPackageDevicesComponent } from './inventory-package-devices.component';

describe('Package receiving screen', () => {
  let fixture: ComponentFixture<InventoryPackageDevicesComponent>, component: InventoryPackageDevicesComponent, api: any;
  const modelId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const summary: any = { packageId: 'bbbbbbbbbbbbbbbbbbbbbbbb', title: 'Compra GPS Septiembre', reception: { expected: 14, received: 5, pending: 9, excess: 0, unexpectedGps: 0, progress: 36, status: 'pending', rows: [
    { key: modelId, kind: 'gps', name: 'Modelo A', expected: 10, received: 4, pending: 6, excess: 0 },
    { key: 'cables', kind: 'cables', name: 'Cables', expected: 3, received: 1, pending: 2, excess: 0 },
    { key: 'relay', kind: 'relay', name: 'Relés', expected: 1, received: 0, pending: 1, excess: 0 },
  ] } };
  beforeEach(async () => {
    spyOn(InventoryPackageDevicesComponent.prototype, 'ngOnInit').and.stub();
    api = { packageReceiving: jasmine.createSpy().and.returnValue(of(structuredClone(summary))), createLot: jasmine.createSpy().and.returnValue(new Subject()) };
    await TestBed.configureTestingModule({ declarations: [InventoryPackageDevicesComponent], imports: [CommonModule, FormsModule, NoopAnimationsModule, TranslateModule.forRoot(), PrimengModule, DeviceLabelPipe], providers: [provideRouter([]),
      { provide: InventoryService, useValue: api }, { provide: ProtocolsService, useValue: {} }, { provide: AuthService, useValue: { hasPrivilege: () => true } }], schemas: [NO_ERRORS_SCHEMA] }).compileComponents();
    fixture = TestBed.createComponent(InventoryPackageDevicesComponent); component = fixture.componentInstance;
    component.currentPackageId = summary.packageId; component.warehouses = [{ _id: 'cccccccccccccccccccccccc', name: 'Principal' }]; component.loadReceiving();
    fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());
  it('shows a separate receiving panel with exact quantities and a model-specific action', () => {
    const panel = fixture.nativeElement.querySelector('.receipt-panel');
    expect(panel.textContent).toContain('Por dar entrada'); expect(panel.querySelectorAll('tbody tr').length).toBe(3);
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain(summary.title);
    const open = spyOn(component, 'openNewDevice').and.callFake(() => { component.selectedDevice = {} as any; });
    panel.querySelector('tbody button').click();
    expect(open).toHaveBeenCalled(); expect(component.selectedDevice?.protocol).toBe(modelId);
  });
  it('opens a focused accessory dialog and sends a package-linked partial receipt only once', async () => {
    fixture.nativeElement.querySelectorAll('.receipt-table tbody button')[1].click(); fixture.detectChanges(); await fixture.whenStable();
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    expect(dialog.open).toBeTrue(); expect(dialog.contains(document.activeElement)).toBeTrue();
    component.accessoryQuantity = 1; component.accessoryWarehouse = component.warehouses[0]._id; component.saveAccessory(); component.saveAccessory();
    expect(api.createLot).toHaveBeenCalledTimes(1); expect(api.createLot.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ category: 'cables', quantity: 1, package_id: summary.packageId, storage_id: component.warehouses[0]._id }));
  });
  it('preserves the immutable request after an uncertain response', () => {
    const response = new Subject(); api.createLot.and.returnValue(response);
    component.receiveLine(summary.reception.rows[1]); component.accessoryWarehouse = component.warehouses[0]._id; component.saveAccessory();
    const first = structuredClone(api.createLot.calls.mostRecent().args[0]); response.error({ status: 0 });
    expect(component.accessoryUnconfirmed).toBeTrue(); component.closeAccessory(); expect(component.accessoryRow).not.toBeNull();
    component.accessoryQuantity = 20; component.saveAccessory(); expect(api.createLot.calls.mostRecent().args[0]).toEqual(first);
  });
  it('keeps the legacy device view for packages without declared contents', () => {
    component.receiving = { packageId: summary.packageId, title: 'Old', reception: null }; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.receipt-panel')).toBeNull(); expect(fixture.nativeElement.querySelector('.package-add-button')).not.toBeNull();
  });
  it('shows a skeleton while loading and an explicit retry after failure', () => {
    const response = new Subject(); api.packageReceiving.and.returnValue(response); component.receiving = null; component.loadReceiving(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.receipt-skeleton')).not.toBeNull(); response.error({ status: 500 }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.receipt-error button').textContent).toContain('Reintentar');
  });
  it('contains the receiving panel at desktop and mobile widths, with horizontal table scrolling', () => {
    const host: HTMLElement = fixture.nativeElement; host.style.display = 'block';
    for (const width of [1280, 375]) {
      host.style.width = width + 'px'; fixture.detectChanges();
      const panel = host.querySelector('.receipt-panel')!.getBoundingClientRect();
      expect(panel.width).toBeGreaterThan(0); expect(panel.right).toBeLessThanOrEqual(host.getBoundingClientRect().right + 1);
      const scroll = host.querySelector('.receipt-table-scroll') as HTMLElement;
      expect(getComputedStyle(scroll).overflowX).toBe('auto');
    }
  });
  it('does not offer reception writes to read-only operators', () => {
    spyOn(component, 'canCreateInventory').and.returnValue(false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.receipt-table tbody button')).toBeNull();
    component.receiveLine(summary.reception.rows[1]); expect(component.accessoryRow).toBeNull();
  });
});

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
import { SystemService } from '../../../../../../core/services/system.service';
import { UserService } from '../../../../../../core/services/user.service';
import { PrimengModule } from '../../../../../../shareds/libraries/primeng/primeng.module';
import { InventoryLotsComponent } from '../inventory-lots/inventory-lots.component';
import { InventoryComponent } from './inventory.component';

describe('Lot selection to conduce UI flow', () => {
  let fixture: ComponentFixture<InventoryComponent>;
  let component: InventoryComponent;
  let inventory: any;
  beforeEach(async () => {
    spyOn(InventoryComponent.prototype, 'ngOnInit').and.stub();
    inventory = {
      getLots: jasmine.createSpy().and.returnValue(of({ total: 1, total_quantity: 100, page: 1, lastPage: 1, data: [
        { _id: 'lot', name: 'Entrada Relay', category: 'relay', balances: [{ storage_id: { _id: 'origin', name: 'Principal' }, quantity: 100 }] },
      ] })),
      createConduce: jasmine.createSpy().and.returnValue(new Subject()),
    };
    await TestBed.configureTestingModule({
      declarations: [InventoryComponent],
      imports: [CommonModule, FormsModule, NoopAnimationsModule, TranslateModule.forRoot(), PrimengModule, InventoryLotsComponent],
      providers: [provideRouter([]),
        { provide: InventoryService, useValue: inventory },
        { provide: ProtocolsService, useValue: {} },
        { provide: AuthService, useValue: { hasPrivilege: () => true } },
        { provide: UserService, useValue: {} },
        { provide: SystemService, useValue: {} },
      ], schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryComponent);
    component = fixture.componentInstance;
    component.loading = false;
    component.currentView = 'relay';
    component.warehouses = [{ _id: 'origin', name: 'Principal', min_quantity: 0 }, { _id: 'destination', name: 'Técnico', min_quantity: 0 }];
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  async function selectLot(): Promise<void> {
    const input = fixture.nativeElement.querySelector('app-inventory-lots tbody input') as HTMLInputElement;
    input.value = '20';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.nativeElement.querySelector('app-inventory-lots tbody button').click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('opens a conduce from the Relay tab with the chosen quantity and enables quantity-only submission', async () => {
    await selectLot();
    expect(component.shippingDialogVisible).toBeTrue();
    expect(component.shippingLots[0].quantity).toBe(20);
    const destination = fixture.nativeElement.querySelector('#shippingWarehouse') as HTMLSelectElement;
    destination.value = 'destination';
    destination.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    const confirm = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('Confirmar Conduce'))!;
    expect(confirm.disabled).toBeFalse();
    confirm.click();
    fixture.detectChanges();
    expect(inventory.createConduce).toHaveBeenCalledWith(jasmine.objectContaining({ destination_warehouse: 'destination', devices: [], simcards: [], lots: [{ lot_id: 'lot', source_warehouse: 'origin', quantity: 20 }] }));
    expect(fixture.nativeElement.querySelector('.lot-shipping-fields').disabled).toBeTrue();
  });

  it('opens the product picker from a conduce and can add a lot without scanning', async () => {
    component.openShippingModal();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.lot-shipping-section > button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panels = fixture.nativeElement.querySelectorAll('app-inventory-lots');
    expect(panels.length).toBe(2);
    panels[1].querySelector('tbody button').click();
    fixture.detectChanges();
    expect(component.lotPickerVisible).toBeFalse();
    expect(component.shippingLots[0].lot_id).toBe('lot');
    expect(fixture.nativeElement.querySelector('.lot-shipping-row').textContent).toContain('Entrada Relay');
  });
});

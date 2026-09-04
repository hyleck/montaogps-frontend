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
import { DeviceLabelPipe } from '../../../../../../shareds/pipes/device-label.pipe';
import { InventoryComponent } from '../inventory/inventory.component';
import { InventoryPackageDevicesComponent } from '../inventory-package-devices/inventory-package-devices.component';
import { InventorySimcardSelectorComponent } from './inventory-simcard-selector.component';

for (const parent of [InventoryComponent, InventoryPackageDevicesComponent]) {
  describe(`${parent.name} SIM selection`, () => {
    let fixture: ComponentFixture<any>;
    let inventory: any;
    const simcard = { _id: 'sim', iccid: '8095551234', idsim: '089014103211118510720', sim_company: 'nacionales' };

    beforeEach(async () => {
      spyOn(parent.prototype, 'ngOnInit').and.stub();
      inventory = {
        searchAllSimcards: jasmine.createSpy().and.returnValue(of({ data: [simcard], total: 1, page: 1, lastPage: 1 })),
        findSimcardByIccid: jasmine.createSpy().and.returnValue(of(simcard)),
        findSimcardsByIdentifier: jasmine.createSpy().and.returnValue(of([simcard])),
        create: jasmine.createSpy().and.returnValue(new Subject()),
        update: jasmine.createSpy().and.returnValue(new Subject()),
      };
      await TestBed.configureTestingModule({
        declarations: [parent],
        imports: [CommonModule, FormsModule, NoopAnimationsModule, TranslateModule.forRoot(), PrimengModule, DeviceLabelPipe, InventorySimcardSelectorComponent],
        providers: [provideRouter([]),
          { provide: InventoryService, useValue: inventory },
          { provide: ProtocolsService, useValue: {} },
          { provide: AuthService, useValue: { hasPrivilege: () => true } },
          { provide: UserService, useValue: {} },
          { provide: SystemService, useValue: {} },
        ], schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();
      fixture = TestBed.createComponent(parent as any);
      const component = fixture.componentInstance;
      component.loading = false;
      component.currentPackageId = 'package';
      component.protocols = [{ label: 'GPS', value: 'protocol' }];
      component.selectedDevice = { _id: 'device', imei: '123456789012345', sim: '', idsim: '', protocol: 'protocol', package: 'package' };
      component.isEditDeviceMode = parent === InventoryComponent;
      component.deviceDialogVisible = true;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    afterEach(() => fixture.destroy());

    it('prevents saving while the code is being resolved and enables saving after selection', async () => {
      const response = new Subject<any[]>();
      inventory.findSimcardsByIdentifier.and.returnValue(response);
      const input: HTMLInputElement = fixture.nativeElement.querySelector('.sim-selector__code input');
      input.value = simcard.idsim;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(fixture.componentInstance.deviceSimLookupPending).toBeTrue();
      fixture.componentInstance.saveDevice();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      fixture.componentInstance.saveDevice();
      expect(inventory.create).not.toHaveBeenCalled();
      expect(inventory.update).not.toHaveBeenCalled();
      response.next([simcard]);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.deviceSimLookupPending).toBeFalse();
      fixture.componentInstance.saveDevice();
      const payload = jasmine.objectContaining({ SIM: simcard.iccid, IDSIM: simcard.idsim });
      if (parent === InventoryComponent) expect(inventory.update).toHaveBeenCalledWith('device', payload);
      else expect(inventory.create).toHaveBeenCalledWith(payload);
    });

    it('automatically selects a scanned ID SIM in the device form and saves its registered phone', async () => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('.sim-selector__code input');
      input.value = simcard.idsim;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(inventory.create).not.toHaveBeenCalled();
      expect(inventory.update).not.toHaveBeenCalled();
      expect(fixture.componentInstance.selectedDevice.sim).toBe(simcard.iccid);
      expect(fixture.componentInstance.selectedDevice.idsim).toBe(simcard.idsim);
      expect(input.value).toBe(simcard.idsim);
      fixture.componentInstance.saveDevice();
      const payload = jasmine.objectContaining({ SIM: simcard.iccid, IDSIM: simcard.idsim });
      if (parent === InventoryComponent) expect(inventory.update).toHaveBeenCalledWith('device', payload);
      else expect(inventory.create).toHaveBeenCalledWith(payload);
    });

    it('replaces manual SIM inputs and saves the selected phone and full ID SIM', async () => {
      expect(fixture.nativeElement.querySelector('#deviceSim')).toBeNull();
      expect(fixture.nativeElement.querySelector('#deviceIdsim')).toBeNull();
      fixture.nativeElement.querySelector('.sim-selector__button').click();
      fixture.detectChanges();
      await fixture.whenStable();
      (document.querySelector('.sim-selector__result') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.selectedDevice.sim).toBe(simcard.iccid);
      expect(fixture.componentInstance.selectedDevice.idsim).toBe(simcard.idsim);
      expect(fixture.nativeElement.querySelector('.sim-selector__card').textContent).toContain(simcard.idsim);
      expect(fixture.nativeElement.querySelector('.sim-selector__code input').value).toBe(simcard.idsim);
      fixture.componentInstance.saveDevice();
      const payload = jasmine.objectContaining({ SIM: simcard.iccid, IDSIM: simcard.idsim, IMEI: '123456789012345' });
      if (parent === InventoryComponent) expect(inventory.update).toHaveBeenCalledWith('device', payload);
      else expect(inventory.create).toHaveBeenCalledWith(payload);
    });
  });
}

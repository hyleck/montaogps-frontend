import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { InventoryRoutingModule } from './inventory-routing.module';
import { InventoryComponent } from './components/inventory/inventory.component';
import { InventoryPackageDevicesComponent } from './components/inventory-package-devices/inventory-package-devices.component';
import { InventoryDeviceAssignmentDialogComponent } from './components/inventory-device-assignment-dialog/inventory-device-assignment-dialog.component';
import { InventoryLotsComponent } from './components/inventory-lots/inventory-lots.component';

@NgModule({
  declarations: [
    InventoryComponent,
    InventoryPackageDevicesComponent,
    InventoryDeviceAssignmentDialogComponent,
  ],
  imports: [CommonModule, FormsModule, TranslateModule, PrimengModule, InventoryRoutingModule, InventoryLotsComponent],
})
export class InventoryModule {}

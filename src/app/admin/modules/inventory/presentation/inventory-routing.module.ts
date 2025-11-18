import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryComponent } from './components/inventory/inventory.component';
import { InventoryPackageDevicesComponent } from './components/inventory-package-devices/inventory-package-devices.component';

const routes: Routes = [
  { path: '', component: InventoryComponent },
  { path: ':packageId', component: InventoryPackageDevicesComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InventoryRoutingModule {}

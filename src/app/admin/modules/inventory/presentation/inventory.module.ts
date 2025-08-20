import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { InventoryRoutingModule } from './inventory-routing.module';
import { InventoryComponent } from './components/inventory/inventory.component';

@NgModule({
  declarations: [InventoryComponent],
  imports: [CommonModule, FormsModule, TranslateModule, PrimengModule, InventoryRoutingModule],
})
export class InventoryModule {}



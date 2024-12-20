import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ManagementRoutingModule } from './management-routing.module';
import { ManagementComponent } from './components/management/management.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { FormsModule } from '@angular/forms';
import { MapsModule } from '../../../../shareds/components/maps/maps.module';


@NgModule({
  declarations: [
    ManagementComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ManagementRoutingModule,
    PrimengModule,
    MapsModule
  ]
})
export class ManagementModule { }

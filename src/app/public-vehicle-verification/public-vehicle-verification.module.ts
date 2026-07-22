import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PublicVehicleVerificationRoutingModule } from './public-vehicle-verification-routing.module';
import { PublicVehicleVerificationComponent } from './public-vehicle-verification.component';
import { PrimengModule } from '../shareds/libraries/primeng/primeng.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    PublicVehicleVerificationComponent,
    PublicVehicleVerificationRoutingModule
  ]
})
export class PublicVehicleVerificationModule { }

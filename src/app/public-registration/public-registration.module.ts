import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PublicRegistrationRoutingModule } from './public-registration-routing.module';
import { PublicRegistrationComponent } from './public-registration.component';
import { PrimengModule } from '../shareds/libraries/primeng/primeng.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    PublicRegistrationComponent,
    PublicRegistrationRoutingModule
  ]
})
export class PublicRegistrationModule { }

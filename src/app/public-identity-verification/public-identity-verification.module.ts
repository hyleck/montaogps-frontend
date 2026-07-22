import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PublicIdentityVerificationRoutingModule } from './public-identity-verification-routing.module';
import { PublicIdentityVerificationComponent } from './public-identity-verification.component';
import { PrimengModule } from '../shareds/libraries/primeng/primeng.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    PublicIdentityVerificationComponent,
    PublicIdentityVerificationRoutingModule
  ]
})
export class PublicIdentityVerificationModule { }

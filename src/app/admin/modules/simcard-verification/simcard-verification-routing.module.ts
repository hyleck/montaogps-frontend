import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SimcardVerificationComponent } from './presentation/components/simcard-verification/simcard-verification.component';
import { EmnifyVerificationComponent } from './presentation/components/emnify-verification/emnify-verification.component';

const routes: Routes = [
  { path: '', component: SimcardVerificationComponent },
  { path: 'emnify-verificacion', component: EmnifyVerificationComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SimcardVerificationRoutingModule { }

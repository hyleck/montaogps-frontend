import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SimcardVerificationComponent } from './presentation/components/simcard-verification/simcard-verification.component';

const routes: Routes = [
  { path: '', component: SimcardVerificationComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SimcardVerificationRoutingModule { }

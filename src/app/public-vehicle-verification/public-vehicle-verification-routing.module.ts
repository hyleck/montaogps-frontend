import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PublicVehicleVerificationComponent } from './public-vehicle-verification.component';

const routes: Routes = [
  {
    path: ':token',
    component: PublicVehicleVerificationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicVehicleVerificationRoutingModule { }

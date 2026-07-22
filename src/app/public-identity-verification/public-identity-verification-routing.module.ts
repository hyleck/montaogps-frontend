import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PublicIdentityVerificationComponent } from './public-identity-verification.component';

const routes: Routes = [
  {
    path: ':token',
    component: PublicIdentityVerificationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicIdentityVerificationRoutingModule { }

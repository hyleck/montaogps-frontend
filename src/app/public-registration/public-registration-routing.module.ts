import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PublicRegistrationComponent } from './public-registration.component';

const routes: Routes = [
  {
    path: ':token',
    component: PublicRegistrationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicRegistrationRoutingModule { }

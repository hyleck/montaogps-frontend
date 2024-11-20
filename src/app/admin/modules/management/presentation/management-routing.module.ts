import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManagementComponent } from './components/management/management.component';

const routes: Routes = [
  { path: '', component: ManagementComponent } // Ruta predeterminada para mostrar el login
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ManagementRoutingModule { }

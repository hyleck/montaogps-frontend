import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManagementComponent } from './components/management/management.component';

const routes: Routes = [
  { path: '', component: ManagementComponent }, // Ruta básica
  { path: ':op', component: ManagementComponent }, // Solo con `op`
  { path: ':op/:user', component: ManagementComponent } // Con ambos
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ManagementRoutingModule { }

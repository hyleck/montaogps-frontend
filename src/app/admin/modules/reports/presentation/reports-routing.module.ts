import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportsComponent } from './components/reports/reports.component';

const routes: Routes = [
  { path: '', component: ReportsComponent }, // Ruta predeterminada
  { path: ':targetId', component: ReportsComponent } // Ruta con parámetro de target ID
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportsRoutingModule { }

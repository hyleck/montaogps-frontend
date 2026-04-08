import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InteraccionesComponent } from './components/interacciones/interacciones.component';

const routes: Routes = [
  { path: '', component: InteraccionesComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InteraccionesRoutingModule { }

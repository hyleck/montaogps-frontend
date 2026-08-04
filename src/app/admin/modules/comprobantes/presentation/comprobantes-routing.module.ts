import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComprobantesComponent } from './components/comprobantes/comprobantes.component';

const routes: Routes = [{ path: '', component: ComprobantesComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ComprobantesRoutingModule {}

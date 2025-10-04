import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MasivoComponent } from './components/masivo/masivo.component';

const routes: Routes = [
  { path: '', component: MasivoComponent }
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MasivoRoutingModule { }
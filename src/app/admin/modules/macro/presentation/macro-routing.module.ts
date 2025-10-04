import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MacroComponent } from './components/macro/macro.component';

const routes: Routes = [
  { path: '', component: MacroComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MacroRoutingModule {}


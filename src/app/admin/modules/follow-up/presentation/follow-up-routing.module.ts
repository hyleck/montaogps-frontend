import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FollowUpComponent } from './components/follow-up/follow-up.component';


const routes: Routes = [
  { path: '', component: FollowUpComponent } // Ruta predeterminada para mostrar el login
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FollowUpRoutingModule { }

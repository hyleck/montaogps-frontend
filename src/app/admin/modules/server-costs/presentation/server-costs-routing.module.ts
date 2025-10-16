import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RootGuard } from '@core/guards/root.guard';
import { ServerCostsComponent } from './components/server-costs/server-costs.component';

const routes: Routes = [
  {
    path: '',
    component: ServerCostsComponent,
    canActivate: [RootGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ServerCostsRoutingModule {}

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RootGuard } from '@core/guards/root.guard';
import { EsterComponent } from './components/ester/ester.component';

const routes: Routes = [
  {
    path: '',
    component: EsterComponent,
    canActivate: [RootGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EsterRoutingModule {}

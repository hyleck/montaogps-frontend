import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AnomaliesComponent } from './components/anomalies/anomalies.component';

const routes: Routes = [
  { path: '', component: AnomaliesComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AnomaliesRoutingModule {}

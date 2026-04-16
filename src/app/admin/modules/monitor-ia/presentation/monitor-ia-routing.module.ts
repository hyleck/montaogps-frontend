import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MonitorIaComponent } from './components/monitor-ia/monitor-ia.component';
import { MonitorIaSegmentationComponent } from './components/monitor-ia-segmentation/monitor-ia-segmentation.component';
import { MonitorIaFunnelComponent } from './components/monitor-ia-funnel/monitor-ia-funnel.component';

const routes: Routes = [
  {
    path: '',
    component: MonitorIaComponent
  },
  {
    path: 'segmentacion',
    component: MonitorIaSegmentationComponent
  },
  {
    path: 'funnel',
    component: MonitorIaFunnelComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MonitorIaRoutingModule { }

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MonitorIaRoutingModule } from './monitor-ia-routing.module';
import { MonitorIaComponent } from './components/monitor-ia/monitor-ia.component';
import { MonitorIaSegmentationComponent } from './components/monitor-ia-segmentation/monitor-ia-segmentation.component';
import { MonitorIaFunnelComponent } from './components/monitor-ia-funnel/monitor-ia-funnel.component';

import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { BadgeModule } from 'primeng/badge';

@NgModule({
  declarations: [
    MonitorIaComponent,
    MonitorIaSegmentationComponent,
    MonitorIaFunnelComponent
  ],
  imports: [
    CommonModule,
    MonitorIaRoutingModule,
    TableModule,
    ProgressBarModule,
    ButtonModule,
    ToastModule,
    BadgeModule,
    FormsModule
  ]
})
export class MonitorIaModule { }

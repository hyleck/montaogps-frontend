import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MonitorIaRoutingModule } from './monitor-ia-routing.module';
import { MonitorIaComponent } from './components/monitor-ia/monitor-ia.component';
import { MonitorIaSegmentationComponent } from './components/monitor-ia-segmentation/monitor-ia-segmentation.component';
import { MonitorIaFunnelComponent } from './components/monitor-ia-funnel/monitor-ia-funnel.component';

import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PaginatorModule } from 'primeng/paginator';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

@NgModule({
  declarations: [
    MonitorIaComponent,
    MonitorIaSegmentationComponent,
    MonitorIaFunnelComponent
  ],
  imports: [
    CommonModule,
    MonitorIaRoutingModule,
    ProgressBarModule,
    ButtonModule,
    ToastModule,
    ConfirmDialogModule,
    PaginatorModule,
    InputTextModule,
    ProgressSpinnerModule,
    TooltipModule,
    FormsModule,
  ],
  providers: [ConfirmationService, MessageService],
})
export class MonitorIaModule { }

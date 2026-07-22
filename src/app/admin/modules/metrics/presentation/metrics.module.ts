import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MetricsRoutingModule } from './metrics-routing.module';
import { MetricsComponent } from './components/metrics/metrics.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';

@NgModule({
  declarations: [
    MetricsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MetricsRoutingModule,
    PrimengModule
  ]
})
export class MetricsModule { }

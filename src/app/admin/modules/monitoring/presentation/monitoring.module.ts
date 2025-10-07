import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringRoutingModule } from './monitoring-routing.module';
import { MonitoringComponent } from './components/monitoring/monitoring.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [
    MonitoringComponent
  ],
  imports: [
    CommonModule,
    MonitoringRoutingModule,
    PrimengModule,
    TranslateModule
  ]
})
export class MonitoringModule { }
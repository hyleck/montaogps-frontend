import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonitoringRoutingModule } from './monitoring-routing.module';
import { MonitoringComponent } from './components/monitoring/monitoring.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { TranslateModule } from '@ngx-translate/core';
import { ProtocolsService } from '../../../../core/services/protocols.service';
import { MonitoringMapComponent } from './components/monitoring-map/monitoring-map.component';

@NgModule({
  declarations: [
    MonitoringComponent,
    MonitoringMapComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MonitoringRoutingModule,
    PrimengModule,
    TranslateModule
  ],
  providers: [
    ProtocolsService
  ]
})
export class MonitoringModule { }

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ReportsRoutingModule } from './reports-routing.module';
import { ReportsComponent } from './components/reports/reports.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { MapsModule } from '../../../../shareds/components/maps/maps.module';

@NgModule({
  declarations: [
    ReportsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ReportsRoutingModule,
    PrimengModule,
    MapsModule
  ]
})
export class ReportsModule { }

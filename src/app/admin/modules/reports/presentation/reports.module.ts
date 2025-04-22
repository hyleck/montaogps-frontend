import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReportsRoutingModule } from './reports-routing.module';
import { ReportsComponent } from './components/reports/reports.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';

@NgModule({
  declarations: [
    ReportsComponent
  ],
  imports: [
    CommonModule,
    ReportsRoutingModule,
    PrimengModule
  ]
})
export class ReportsModule { }

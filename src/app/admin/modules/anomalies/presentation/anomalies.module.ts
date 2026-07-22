import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { AnomaliesRoutingModule } from './anomalies-routing.module';
import { AnomaliesComponent } from './components/anomalies/anomalies.component';

@NgModule({
  declarations: [AnomaliesComponent],
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    AnomaliesRoutingModule,
  ],
})
export class AnomaliesModule {}

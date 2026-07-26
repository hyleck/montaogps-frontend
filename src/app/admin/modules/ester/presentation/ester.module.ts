import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { EsterComponent } from './components/ester/ester.component';
import { EsterRoutingModule } from './ester-routing.module';

@NgModule({
  declarations: [EsterComponent],
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    EsterRoutingModule,
  ],
})
export class EsterModule {}

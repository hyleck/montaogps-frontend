import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TargetFormComponent } from './target-form.component';
import { PrimengModule } from '../../../../../../../shareds/libraries/primeng/primeng.module';



@NgModule({
  declarations: [
    TargetFormComponent
  ],
  imports: [
    CommonModule,
    PrimengModule
  ],
  exports: [
    TargetFormComponent
  ]
})
export class TargetFormModule { }

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TargetFormComponent } from './target-form.component';
import { PrimengModule } from '../../../../../../../shareds/libraries/primeng/primeng.module';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    TargetFormComponent
  ],
  imports: [
    CommonModule,
    PrimengModule,
    FormsModule
  ],
  exports: [
    TargetFormComponent
  ]
})
export class TargetFormModule { }

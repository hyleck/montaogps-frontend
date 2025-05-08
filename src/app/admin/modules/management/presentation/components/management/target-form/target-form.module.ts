import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TargetFormComponent } from './target-form.component';
import { PrimengModule } from '../../../../../../../shareds/libraries/primeng/primeng.module';
import { FormsModule } from '@angular/forms';
import { CloudModule } from '../../../../../../../shareds/components/cloud/cloud.module';


@NgModule({
  declarations: [
    TargetFormComponent
  ],
  imports: [
    CommonModule,
    PrimengModule,
    FormsModule,
    CloudModule
  ],
  exports: [
    TargetFormComponent
  ]
})
export class TargetFormModule { }

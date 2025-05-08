import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CloudComponent } from './cloud.component';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    CloudComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    CloudComponent
  ]
})
export class CloudModule { }

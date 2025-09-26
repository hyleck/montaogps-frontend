import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CloudComponent } from './cloud.component';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ConfirmDialogModule,
    CloudComponent
  ],
  exports: [
    CloudComponent
  ]
})
export class CloudModule { }

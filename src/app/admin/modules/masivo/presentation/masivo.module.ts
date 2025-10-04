import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MasivoRoutingModule } from './masivo-routing.module';
import { MasivoComponent } from './components/masivo/masivo.component';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { SplitButtonModule } from 'primeng/splitbutton';
import { DropdownModule } from 'primeng/dropdown';

@NgModule({
  declarations: [
    MasivoComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MasivoRoutingModule,
    DialogModule,
    ButtonModule,
    TableModule,
    ToastModule,
    InputTextModule,
    SplitButtonModule,
    DropdownModule
  ]
})
export class MasivoModule { }
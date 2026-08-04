import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComprobantesRoutingModule } from './comprobantes-routing.module';
import { ComprobantesComponent } from './components/comprobantes/comprobantes.component';

@NgModule({
  declarations: [ComprobantesComponent],
  imports: [CommonModule, FormsModule, ComprobantesRoutingModule],
})
export class ComprobantesModule {}

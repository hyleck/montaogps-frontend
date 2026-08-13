import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InstructivosComponent } from './components/instructivos/instructivos.component';
import { InstructivosRoutingModule } from './instructivos-routing.module';

@NgModule({
  declarations: [InstructivosComponent],
  imports: [CommonModule, FormsModule, InstructivosRoutingModule],
})
export class InstructivosModule {}

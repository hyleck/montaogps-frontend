import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EmpleadosRoutingModule } from './empleados-routing.module';
import { EmpleadosComponent } from './components/empleados/empleados.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    EmpleadosComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    EmpleadosRoutingModule,
    PrimengModule
  ]
})
export class EmpleadosModule { }

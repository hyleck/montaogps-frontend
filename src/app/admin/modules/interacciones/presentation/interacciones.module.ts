import { DeviceLabelMessageService, DeviceLabelConfirmationService } from 'src/app/shareds/services/device-label-messages.service';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { InteraccionesRoutingModule } from './interacciones-routing.module';
import { InteraccionesComponent } from './components/interacciones/interacciones.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { MessageService, ConfirmationService } from 'primeng/api';

@NgModule({
  declarations: [
    InteraccionesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    InteraccionesRoutingModule,
    PrimengModule,
  ],
  providers: [
    { provide: MessageService, useClass: DeviceLabelMessageService },
    { provide: ConfirmationService, useClass: DeviceLabelConfirmationService },
  ]
})
export class InteraccionesModule { }

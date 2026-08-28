import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputSwitchModule } from 'primeng/inputswitch';

import { CommunicationRoutingModule } from './communication-routing.module';
import { CommunicationComponent } from './components/communication/communication.component';
import { ForumComponent } from './components/forum/forum.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';

@NgModule({
  declarations: [
    CommunicationComponent,
    ForumComponent
  ],
  imports: [
    DeviceLabelPipe,
    CommonModule,
    FormsModule,
    CommunicationRoutingModule,
    PrimengModule,
    InputSwitchModule
  ]
})
export class CommunicationModule { }
